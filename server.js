// Author: Dany Fu (danyfu@bu.edu)

const ax = require("axios").default;
const rateLimit = require("axios-rate-limit");
const axios = rateLimit(ax.create(), { maxRequests: 25, perMilliseconds: 1000});
const csv = require("fast-csv");
const fs = require("fs");
const argv = require("minimist")(process.argv.slice(2));
const config = require('config');
const constants = require("./constants.js");

/*****************
 * Logging
 * @type {winston}
 *****************/
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;
const myFormat = printf(({ level, message, timestamp }) => {
  return `{${timestamp} ${level}: ${message}}`;
});
let today = new Date().toLocaleDateString("en-US", {timeZone: "America/New_York"});
let todayFormatted = today.substring(0, 10).replace(/\//g, "-");
let now = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
const logger = createLogger({
  format: combine(
    timestamp({
      format: now
    }),
    myFormat
  ),
  level: 'info',
  transports: [
    // - Write all logs with level `error` and below to `error.log`
    new transports.File({ filename: `logs/error-${todayFormatted}.log`, level: 'error' }),
    // - Write all logs with level `info` and below to `combined.log`
    new transports.File({ filename: `logs/combined-${todayFormatted}.log` }),
  ],
});


/*******************
 * HELPER FUNCTIONS
 *******************/
function equalsIgnoringCase(text, other) {
  return text.localeCompare(other, undefined, { sensitivity: 'accent' }) === 0;
}

function isEmpty(str) {
  return (!str || str.trim().length === 0);
}

function isOdd(num) {
  return num % 2 === 1;
}

function isEven(num) {
  return num % 2 === 0;
}

function getNumAttempts(patientSample){
  return patientSample.data[0].meta.find(m => m.key === constants.META.NUM_ATTEMPTS).value;
}

function getSampleId(patientSample){
  return patientSample.data[0].sampleID;
}

function stringToArray(str){
  str = str.replace(/'|"/g, "");
  return str.replace(/^\[|\]$/g, "").split(",");
}

function isControl(sample){
  return Object.values(constants.CONTROLS).some(v => sample.includes(v))
}

function getWarningWells(data){
  const regex = /(.*),.*,WARNING/g;
  let found = [...data.matchAll(regex)];
  if(found.length){
    return Array.from(found, f => f[1]);
  }
  return null;
}

function isWellCall(data){
  const regex = /\[Well Call\]/g;
  return regex.exec(data);
}

function getqPCRUser(data) {
  const regex = /# User Name: (.*)/g;
  let found = regex.exec(data);
  if(found){
    return found[1];
  }
  return null;
}

function getqPCRSN(data) {
  const regex = /# Instrument Serial Number: (.*)/g;
  let found = regex.exec(data);
  if(found){
    return found[1];
  }
  return null;
}


/******************
 * ELAB API CALLS
 ******************/

/**
 * Update a custom field for a Covid-19 sample
 * @param sampleId The unique ID of the sample generated by eLabs
 * @param key Name of the field to be updated
 * @param value Value of the field to be updated
 * @param type The field type (dropdown, text, radio button, etc)
 * @param metaId The sampleTypeMetaID
 * @returns {Promise<void>}
 */
async function updateMeta({sampleId, key, value, type, metaId}={}){
  return axios
    .put(`${config.get('endpoints.samples')}/${sampleId}/meta`, {
      key: key,
      value: value,
      sampleDataType: type,
      sampleTypeMetaID: metaId
    })
    .then((res) => {
      if(res.status === 200){
        logger.info(`Update sample: ${sampleId}, field:${key}, statusCode: ${res.status}`);
      } else {
        logger.error(`Failed to update sample:${sampleId}, meta field: ${key}. 
                      Error: ${res.data}. SAMPLE ID:${sampleId} NOT CORRECTLY PROCESSED.`);
        process.exitCode = 8;
        return null;
      }
    })
    .catch((error) => {
      if(error.response){
        logger.error(`Failed to update sample: ${sampleId}, meta field: ${key}. Status: ${error.response.status}. 
                      StatusText: ${error.response.statusText}. Error Message: ${error.response.data}.
                      SAMPLE ID:${sampleId} NOT CORRECTLY PROCESSED.`);
      } else {
        logger.error(`No response received from ELAB when updating meta field. Try again later.`);
        logger.error(`Error dump: ${error}`);
      }
      process.exitCode = 8;
      return null;
    });
}

/**
 * Find a Covid-19 Sample with the given barcode (which is also its name)
 * Returns null if more than one sample can be found with the same barcode
 * @param barcode Name of the sample
 * @returns {Promise<void>} Sample object with all custom fields if found, else Null
 */
async function getPatientSample(barcode){
  let endpoint = `${config.get('endpoints.samples')}` +
    `?$expand=meta&sampleTypeID=${config.get('covidSampleTypeId')}` +
    `&name=${barcode}`;

  return axios.get(endpoint)
    .then((res) => {
      if(res.status === 200){
        if(res.data.data.length === 0){
          process.exitCode = 8;
          logger.error(`Sample for barcode ID ${barcode} not found. 
                        SAMPLE BC:${barcode} NOT PROCESSED.`);
          return null;
        }
        else if(res.data.data.length === 1){
          logger.info(`Got sample with barcode ${barcode}, statusCode: ${res.status}`);
          return res.data;
        } else {
          logger.error(`More than one sample found with name ${barcode}. 
                        SAMPLE BC:${barcode} NOT PROCESSED.`);
          process.exitCode = 8;
          return null;
        }
      } else{
        logger.error(res.data);
        process.exitCode = 8;
        return null;
      }
    })
    .catch((error) => {
      if(error.response){
        logger.error(`Failed to get sample: ${barcode}. Status: ${error.response.status}. 
                      StatusText: ${error.response.statusText}. Error Message: ${error.response.data}.
                      SAMPLE BC:${barcode} NOT PROCESSED.`);
      } else {
        logger.error(`No response received from ELAB when fetching sample. Try again later.`);
        logger.error(`Error dump: ${error}`);
      }
      process.exitCode = 8;
      return null;
    });
}

/**
 * Get all the meta fields for COVID-19 SampleType
 * The sampleTypeId is pulled from config
 * @returns {Promise<T>}
 */
async function getCovidSampleTypeMetas(){
  return axios.get(`${config.get('endpoints.sampleTypes')}/${config.get('covidSampleTypeId')}/meta`)
    .then((res) => {
      if(res.status === 200){
        logger.info(`Got COVID-19 sampleType, statusCode: ${res.status}`);
        return res.data.data;
      } else {
        logger.error(`Got statusCode when fetching sample type: ${res.status}`);
        process.exitCode = 8;
        return null;
      }
    })
    .catch((error) => {
      if(error.response){
        logger.error(`Failed to find COVID-19 sample type. Status: ${error.response.status}. 
                      StatusText: ${error.response.statusText}. Error Message: ${error.response.data}.`);
      } else {
        logger.error(`No response received from ELAB when fetching COVID-19 sample type. Try again later.`);
        logger.error(`Error dump: ${error}`);
      }
      process.exitCode = 8;
      return null;
    });
}



/******************************
 * HAMILTON RELATED FUNCTIONS
 ******************************/

/**
 * Update Covid-19 Sample with the plate barcode and well number
 * from the Sample Prep Hamilton and update status
 * @param sampleID Unique ID of the sample in eLabs
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @param destBC Output plate barcode
 * @param destWellNum Output well number
 * @param user Technician initials
 * @param serialNum Serial number of the Hamilton robot
 * @returns {Promise<void>}
 */
async function samplePrepTracking(sampleID, metas, destBC, destWellNum, user, serialNum){

  const dwBC = metas.find(m => m.key === constants.META.DEEPWELL_BC);
  updateMeta({sampleId:sampleID,
    key: constants.META.DEEPWELL_BC,
    value: destBC,
    type: dwBC.sampleDataType,
    metaId: dwBC.sampleTypeMetaID}); //update RNA Plate Barcode

  const dwWN = metas.find(m => m.key === constants.META.DEEPWELL_WELL_NUM);
  updateMeta({sampleId:sampleID,
    key: constants.META.DEEPWELL_WELL_NUM,
    value: destWellNum,
    type: dwWN.sampleDataType,
    metaId: dwWN.sampleTypeMetaID}); //update RNA Plate Well Location

  const status = metas.find(m => m.key === constants.META.STATUS);
  updateMeta({sampleId:sampleID,
    key: constants.META.STATUS,
    value: constants.STATUS_VAL.SAMPLE_PREP_DONE,
    type: status.sampleDataType,
    metaId: status.sampleTypeMetaID}); //update status to "Sample Transferred To 96-Well Plate"

  const userMeta = metas.find(meta => meta.key === constants.META.SAMPLE_PREP_TECH);
  updateMeta({sampleId:sampleID,
    key: constants.META.SAMPLE_PREP_TECH,
    value: user,
    type: userMeta.sampleDataType,
    metaId: userMeta.sampleTypeMetaID}); //update initials of "Sample Aliquot User"

  const snMeta = metas.find(meta => meta.key === constants.META.SAMPLE_PREP_SN);
  updateMeta({sampleId:sampleID,
    key: constants.META.SAMPLE_PREP_SN,
    value: serialNum,
    type: snMeta.sampleDataType,
    metaId: snMeta.sampleTypeMetaID}); //update "Sample Aliquot Instrument SN"
}

/**
 * Updates Covid-19 Sample with the plate barcode and well number
 * from the RNA Extraction Hamilton and update status
 * @param sampleID Unique ID of the sample in eLabs
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @param destBC Output plate barcode
 * @param destWellNum Output well number
 * @param user Technician initials
 * @param serialNum Serial number of the Hamilton robot
 * @returns {Promise<void>}
 */
async function rnaExtractionTracking(sampleID, metas, destBC, destWellNum, user, serialNum){

  const rnaBC = metas.find(m => m.key === constants.META.RNA_PLATE_BC);
  updateMeta({sampleId:sampleID,
    key: constants.META.RNA_PLATE_BC,
    value: destBC,
    type: rnaBC.sampleDataType,
    metaId: rnaBC.sampleTypeMetaID}); //update RNA Plate Barcode

  const rnaWN = metas.find(m => m.key === constants.META.RNA_PLATE_WELL_NUM);
  updateMeta({sampleId:sampleID,
    key: constants.META.RNA_PLATE_WELL_NUM,
    value: destWellNum,
    type: rnaWN.sampleDataType,
    metaId: rnaWN.sampleTypeMetaID}); //update RNA Plate Well Location

  const status = metas.find(m => m.key === constants.META.STATUS);
  updateMeta({sampleId:sampleID,
    key: constants.META.STATUS,
    value: constants.STATUS_VAL.RNA_DONE,
    type: status.sampleDataType,
    metaId: status.sampleTypeMetaID}); //update status to "RNA Extracted"

  const userMeta = metas.find(meta => meta.key === constants.META.EXTRACTION_TECH);
  updateMeta({sampleId:sampleID,
    key: constants.META.EXTRACTION_TECH,
    value: user,
    type: userMeta.sampleDataType,
    metaId: userMeta.sampleTypeMetaID}); //update initials of "RNA Extraction User"

  const snMeta = metas.find(meta => meta.key === constants.META.EXTRACTION_SN);
  updateMeta({sampleId:sampleID,
    key: constants.META.EXTRACTION_SN,
    value: serialNum,
    type: snMeta.sampleDataType,
    metaId: snMeta.sampleTypeMetaID}); //update "RNA Extraction Instrument SN"
}

/**
 * Updates Covid-19 Sample with the plate barcode and well number
 * from the qPCR Prep Hamilton and update status
 * @param sampleID Unique ID of the sample in eLabs
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @param destBC Output plate barcode
 * @param destWellNum Output well number
 * @param user Technician initials
 * @param serialNum Serial number of the Hamilton robot
 * @returns {Promise<void>}
 */
function qPCRPrepTracking(sampleID, metas, destBC, destWellNum, user, serialNum){

  const pcrBC = metas.find(m => m.key === constants.META.QPCR_PLATE_BC);
  updateMeta({sampleId:sampleID,
    key: constants.META.QPCR_PLATE_BC,
    value: destBC,
    type: pcrBC.sampleDataType,
    metaId: pcrBC.sampleTypeMetaID}); //update RNA Plate Barcode

  const pcrWN = metas.find(m => m.key === constants.META.QPCR_PLATE_WELL_NUM);
  updateMeta({sampleId:sampleID,
    key: constants.META.QPCR_PLATE_WELL_NUM,
    value: destWellNum,
    type: pcrWN.sampleDataType,
    metaId: pcrWN.sampleTypeMetaID}); //update RNA Plate Well Location

  const status = metas.find(meta => meta.key === constants.META.STATUS);
  updateMeta({sampleId:sampleID,
    key: constants.META.STATUS,
    value: constants.STATUS_VAL.QPCR_PREP_DONE,
    type: status.sampleDataType,
    metaId: status.sampleTypeMetaID}); //update status to "qPCR Reactions Prepared"

  const userMeta = metas.find(meta => meta.key === constants.META.QPCR_PREP_TECH);
  updateMeta({sampleId:sampleID,
    key: constants.META.QPCR_PREP_TECH,
    value: user,
    type: userMeta.sampleDataType,
    metaId: userMeta.sampleTypeMetaID}); //update initials of "qPCR Prep User"

  const snMeta = metas.find(meta => meta.key === constants.META.QPCR_PREP_SN);
  updateMeta({sampleId:sampleID,
    key: constants.META.QPCR_PREP_SN,
    value: serialNum,
    type: snMeta.sampleDataType,
    metaId: snMeta.sampleTypeMetaID}); //update "qPCR Prep Instrument SN"
}

/**
 * Updates a Covid-19 Sample with the reagent lot number it was processed with
 * @param sampleID Unique ID of the sample in eLab
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @param reagentNames Array of reagent names used
 * @param reagentNums Array of reagent lot numbers, matches the names by index
 */
function reagentTracking(sampleID, metas, reagentNames, reagentNums){
  reagentNames = stringToArray(reagentNames);
  reagentNums = stringToArray(reagentNums);

  if(reagentNames.length !== reagentNums.length){
    logger.error(`Length of reagent names do not match length of reagent lot numbers.
                  SAMPLE ID:${sampleID} NOT CORRECTLY PROCESSED.`);
    process.exitCode = 8;
    return null;
  }
  for (let i = 0; i < reagentNames.length; i++) {
    const reagentMeta = metas.find(meta => meta.key === reagentNames[i]);
    if(reagentMeta){
      updateMeta({sampleId:sampleID,
        key: reagentNames[i],
        value: reagentNums[i],
        type: reagentMeta.sampleDataType,
        metaId: reagentMeta.sampleTypeMetaID}); //Update reagent lot number
    } else {
      logger.error(`Reagent field ${reagentNames[i]} cannot be found.
                    SAMPLE ID:${sampleID} NOT CORRECTLY PROCESSED.`);
      process.exitCode = 8;
    }
  }
}

/**
 * Calls the appropriate update function based on Hamilton protocol
 * @param sampleID Unique ID of the sample in eLab
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @param protocol A string indicating which robot the log originated from
 * @param destBC Output plate barcode
 * @param destWellNum Output well number
 * @param user Technician initials
 * @param serialNum Serial number of the Hamilton robot
 */
function lineageTracking(sampleID, metas, protocol, destBC, destWellNum, user, serialNum){
  switch(protocol){
    case constants.ORIGIN_VAL.SAMPLE_ALIQUOT:
      samplePrepTracking(sampleID, metas, destBC, destWellNum, user, serialNum);
      break;
    case constants.ORIGIN_VAL.RNA_EXTRACTION:
      rnaExtractionTracking(sampleID, metas, destBC, destWellNum, user, serialNum);
      break;
    case constants.ORIGIN_VAL.QPCR_PREP:
      qPCRPrepTracking(sampleID, metas, destBC, destWellNum, user, serialNum);
      break;
  }
}

/**
 * Get data from each row of the Hamilton log and calls the appropriate function
 * to update eLabs records
 * @param csvRow
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @returns {Promise<void>}
 */
async function hamiltonTracking(csvRow, metas){
  let sampleBC = csvRow[constants.HAMILTON_LOG_HEADERS.SAMPLE_TUBE_BC];

  let protocol = csvRow[constants.HAMILTON_LOG_HEADERS.PROTOCOL];
  if (!protocol || (!(protocol in constants.ORIGIN_VAL))){
    let protocolVals = Object.keys(constants.ORIGIN_VAL);
    logger.error(`${protocol} is not recognized as a supported process. Must be one of the
                  ${protocolVals.length} values: ${Object.keys(constants.ORIGIN_VAL)}.
                  SAMPLE BC:${sampleBC} NOT PROCESSED.`);
    process.exitCode = 8;
    return;
  }

  let sampleObj = await getPatientSample(sampleBC);
  if(!sampleObj){
    process.exitCode = 8;
    return;
  }

  let sampleID = getSampleId(sampleObj);
  let reagentNames = csvRow[constants.HAMILTON_LOG_HEADERS.REAGENT_NAMES];
  let reagentNums = csvRow[constants.HAMILTON_LOG_HEADERS.REAGENT_NUMS];
  reagentTracking(sampleID, metas, reagentNames, reagentNums);


  let destBC = csvRow[constants.HAMILTON_LOG_HEADERS.DEST_BC];
  let destWellNum = csvRow[constants.HAMILTON_LOG_HEADERS.DEST_WELL_NUM];
  let user = csvRow[constants.HAMILTON_LOG_HEADERS.USER];
  let serialNum = csvRow[constants.HAMILTON_LOG_HEADERS.SERIAL_NUM];
  lineageTracking(sampleID, metas, protocol, destBC, destWellNum, user, serialNum);
}


/********************************
 * QUANTSTUDIO RELATED FUNCTIONS
 ********************************/

/**
 * Increases number of attempt by 1 if allowed and returns the total number of attempts
 * @param sampleObj data object of the sample from eLab
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @returns {Promise<*>}
 */
async function increaseAttempt(sampleObj, metas){
  // Check number of attempts
  let numAttempt = getNumAttempts(sampleObj);

  if (numAttempt < 2){
    let sampleID = getSampleId(sampleObj);
    const attemptMeta = metas.find(m => m.key === constants.META.NUM_ATTEMPTS);
    await updateMeta({sampleId:sampleID,
      key: constants.META.NUM_ATTEMPTS,
      value: ++numAttempt,
      type: attemptMeta.sampleDataType,
      metaId: attemptMeta.sampleTypeMetaID}); //Increase number of attempts by 1
  }
  return numAttempt;
}

/**
 * Updates status and result of samples that belong to the plate which had a failed control
 * @param sampleObj data object of the sample from eLab
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @param statusConst Either "Re-run qPCR" or "Re-run RNA Extraction"
 * @returns {Promise<void>}
 */
async function updateFailed(sampleObj, metas, statusConst){
  let sampleID = getSampleId(sampleObj);
  let numAttempt = await increaseAttempt(sampleObj, metas);

  const result = metas.find(m => m.key === constants.META.RESULT);
  const status = metas.find(m => m.key === constants.META.STATUS);

  // If it's less than 2, we can rerun
  if (numAttempt < 2){
    updateMeta({sampleId:sampleID,
      key: constants.META.RESULT,
      value: constants.TEST_RESULT.WARNING,
      type: result.sampleDataType,
      metaId: result.sampleTypeMetaID}); //update Test Result to "Control Failed"

    updateMeta({sampleId:sampleID,
      key: constants.META.STATUS,
      value: statusConst,
      type: status.sampleDataType,
      metaId: status.sampleTypeMetaID}); // Update status to re-prep or re-extract
  } else {
    updateMeta({sampleId:sampleID,
      key: constants.META.RESULT,
      value: constants.TEST_RESULT.INVALID,
      type: result.sampleDataType,
      metaId: result.sampleTypeMetaID}); //Update Test Result to "Invalid - recollect"

    updateMeta({sampleId:sampleID,
      key: constants.META.STATUS,
      value: constants.STATUS_VAL.QPCR_DONE,
      type: status.sampleDataType,
      metaId: status.sampleTypeMetaID}); //update status to "Finished"
  }
}

/**
 * Updates status and result of samples that did not fail its control sample
 * @param sampleObj data object of the sample from eLab
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @param call Result of the well from the Call column of the qPCR output
 * @returns {Promise<void>}
 */
async function updatePassed(sampleObj, metas, call){
  let sampleID = getSampleId(sampleObj);
  increaseAttempt(sampleObj, metas);

  const result = metas.find(m => m.key === constants.META.RESULT);
  updateMeta({sampleId:sampleID,
    key: constants.META.RESULT,
    value: constants.TEST_RESULT[call],
    type: result.sampleDataType,
    metaId: result.sampleTypeMetaID}); //update COVID-19 Test Result


  const status = metas.find(m => m.key === constants.META.STATUS);
  updateMeta({sampleId:sampleID,
    key: constants.META.STATUS,
    value: constants.STATUS_VAL.QPCR_DONE,
    type: status.sampleDataType,
    metaId: status.sampleTypeMetaID}); //update status to "qPCR Complete"
}

/**
 * Update "call" of the test, results can be POSITIVE, NEGATIVE, INVALID, INCONCLUSIVE, or WARNING
 * INVALID or INCONCLUSIVE results both require recollection of sample
 * WARNING occurs when controls failed, and can be reattempted up to 1 more time
 * If controls fail during attempt #2, a recollection is required
 * @param csvRow
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @param failedWells Dictionary of all possible failed wells and their respective status
 * @param user Initials of the technician who initiated the qPCR run
 * @param serialNum Serial number of the qPCR machine
 * @returns {Promise<void>}
 */
async function updateTestResult(csvRow, metas, failedWells, user, serialNum){
  let sampleBC = csvRow[constants.QPCR_LOG_HEADERS.SAMPLE];
  if (isControl(sampleBC)) {
    return;
  }

  let sampleObj = await getPatientSample(sampleBC);
  if(!sampleObj){
    process.exitCode = 8;
    return;
  }

  let sampleID = getSampleId(sampleObj);
  const userMeta = metas.find(meta => meta.key === constants.META.QPCR_TECH);
  updateMeta({sampleId:sampleID,
    key: constants.META.QPCR_TECH,
    value: user,
    type: userMeta.sampleDataType,
    metaId: userMeta.sampleTypeMetaID}); //update initials of "qPCR User"

  const snNumMeta = metas.find(meta => meta.key === constants.META.QPCR_SN);
  updateMeta({sampleId:sampleID,
    key: constants.META.QPCR_SN,
    value: serialNum,
    type: snNumMeta.sampleDataType,
    metaId: snNumMeta.sampleTypeMetaID}); //update "qPCR SN"

  let wellNum = csvRow[constants.QPCR_LOG_HEADERS.WELL];
  if (wellNum in failedWells){
    updateFailed(sampleObj, metas, failedWells[wellNum]);
  } else {
    let call = csvRow[constants.QPCR_LOG_HEADERS.CALL];
    updatePassed(sampleObj, metas, call)
  }
}

/**
 * Updates PatientSample with CT values from the QuantStudio
 * @param csvRow
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @returns {Promise<void>}
 */
async function updateCTValues(csvRow, metas){
  let sampleBC = csvRow[constants.QPCR_LOG_HEADERS.SAMPLE];
  if (isControl(sampleBC)) {
    return;
  }

  let sampleObj = await getPatientSample(sampleBC);
  if(!sampleObj){
    process.exitCode = 8;
    return;
  }

  let sampleID = getSampleId(sampleObj);
  let target = csvRow[constants.QPCR_LOG_HEADERS.TARGET];
  let cq = csvRow[constants.QPCR_LOG_HEADERS.CQ];
  const targetMeta = metas.find(m => m.key === constants.META[target]);
  updateMeta({sampleId:sampleID,
    key: constants.META[target],
    value: cq,
    type: targetMeta.sampleDataType,
    metaId: targetMeta.sampleTypeMetaID}); //update CT value
}

/**
 * Creates a dictionary of all *possible* wells in a 384 that match a failed control
 * PCR_POS failure means all samples need to be re-prepped
 * NTC/NEC failures mean that specific plate needs to be re-extracted (takes precedence)
 * @param failedControls Array of control names that failed (warning)
 * @returns {*} key: well position, value: status
 */
function getFailureWells(failedControls){
  let failedWells = {};
  for(let failed of failedControls){
    if(!constants.CONTROL_WELLS.includes(failed)){
      logger.error(`${failed} is not a valid Control well`);
      process.exitCode = 8;
      return null;
    }

    const plateRows = new Array( constants.PLATE384.ROW ).fill(1).map( (_, i) => String.fromCharCode(65 + i));
    const plateCols = Array.from(Array(constants.PLATE384.COL), (_, i) => (i + 1).toString());

    if(failed === constants.CONTROL_WELLS[0]){
      // re-prep all the wells on the plate
      for (let i = 0; i < plateRows.length; i++) {
        for (let j = 0; j < plateCols.length; j++) {
          failedWells[`${plateRows[i]}${plateCols[j]}`] = constants.STATUS_VAL.RE_QPCR;
        }
      }
    } else{
      let rIndex = plateRows.indexOf(failed[0]);
      let cIndex = plateCols.indexOf(failed[1]);
      let failedRows = isOdd(rIndex) ? plateRows.filter((_,i)=>isOdd(i)) : plateRows.filter((_,i)=>isEven(i));
      let failedCols = isOdd(cIndex) ? plateCols.filter((_,i)=>isOdd(i)) : plateCols.filter((_,i)=>isEven(i));
      for (let i = 0; i < failedRows.length; i++) {
        for (let j = 0; j < failedCols.length; j++) {
          failedWells[`${failedRows[i]}${failedCols[j]}`] = constants.STATUS_VAL.RE_EXTRACT;
        }
      }
    }
  }

  return failedWells;
}

/**
 * Handles parsing of all Hamilton and QuantStudio CSV output
 * @param logfile Output from Hamilton or QuantStudio
 * @param metas Array of meta fields associated with the COVID-19 SampleType
 * @param failedWells Dictionary of all possible failed wells and their respective status
 * @param qPCRUser Required for Well Call file
 * @param qPCRSerialNum Required for Well Call file
 */
function parseCSV(logfile, metas, failedWells, qPCRUser, qPCRSerialNum){
  let readStream = fs.createReadStream(logfile);
  readStream.pipe(csv.parse({
    headers:true,
    comment:"#", //ignore lines that begin with #
    skipLines:2 })
  )
    .on('data', (row) => {
      if (Object.keys(row).includes(constants.HAMILTON_LOG_HEADERS.PROTOCOL)){
        hamiltonTracking(row, metas);
      } else if (Object.keys(row).includes(constants.QPCR_LOG_HEADERS.CQ)){
        updateCTValues(row, metas);
      } else if (Object.keys(row).includes(constants.QPCR_LOG_HEADERS.CALL)){
        updateTestResult(row, metas, failedWells, qPCRUser, qPCRSerialNum);
      }
    })
    .on('error', (error) => {
      logger.error(error);
      process.exitCode = 8;
      readStream.destroy();
    })
    .on('end', (rowCount) => logger.info(`Parsed ${rowCount} records`));
}

async function main(logfile){
  logger.info(logfile);

  let token = config.get('authToken');
  if (isEmpty(token)){
    logger.error(`No authentication token found in config. NO SAMPLE IN LOGFILE:${logfile} WAS PROCESSED.`);
    process.exitCode = 8;
    return;
  }
  axios.defaults.headers.common['Authorization'] = token;

  let metas = await getCovidSampleTypeMetas();
  if (!metas){
    logger.error(`Error occurred when getting SampleType. NO SAMPLE IN LOGFILE:${logfile} WAS PROCESSED.`);
    process.exitCode = 8;
    return;
  }

  let fileData = fs.readFileSync(logfile, 'utf8');
  let failedWells = {};
  let qPCRUser = "";
  let qPCRSerialNum = "";
  if (isWellCall(fileData)){
    // look for control failures
    let failedControls = getWarningWells(fileData);
    if(failedControls){
      logger.info(`Failed controls ${failedControls}`);
      failedWells = getFailureWells(failedControls);
    }

    // get technician info
    qPCRUser = getqPCRUser(fileData);

    // get machine serial number
    qPCRSerialNum = getqPCRSN(fileData);

    if (!failedWells){
      logger.error(`Error occurred when parsing control fails. NO SAMPLE IN LOGFILE:${logfile} WAS PROCESSED.`);
      process.exitCode = 8;
      return;
    }

    if (isEmpty(qPCRUser)){
      logger.error(`Error occurred when parsing user initials. NO SAMPLE IN LOGFILE:${logfile} WAS PROCESSED.`);
      process.exitCode = 8;
      return;
    }

    if (isEmpty(qPCRSerialNum)){
      logger.error(`Error occurred when parsing instrument serial number. NO SAMPLE IN LOGFILE:${logfile} WAS PROCESSED.`);
      process.exitCode = 8;
      return;
    }
  }

  parseCSV(logfile, metas, failedWells, qPCRUser, qPCRSerialNum);
}

/**
 * file: path of the CSV file to be parsed
 */
main(argv.file);

process.on('unhandledRejection', (reason, promise) => {
  process.exitCode = 8;
  logger.error(`Unhandled Rejection at: ${reason.stack || reason}`)
});
process.on('exit', (code) => {
  console.log(`Exited with code ${code}`);
  logger.info(`Process exit event with code:${code}`);
});
