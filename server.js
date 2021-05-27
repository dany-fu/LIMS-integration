// Author: Dany Fu (danyfu@bu.edu)

const ax = require("axios");
const rateLimit = require("axios-rate-limit");
const axios = rateLimit(ax.create(), { maxRequests: 5, perMilliseconds: 1000});
const csv = require("fast-csv");
const fs = require("fs");
const argv = require("minimist")(process.argv.slice(2));
const config = require("config");
const path = require("path");
const constants = require("./constants.js");
const timeout = 5000; //ms

/*****************
 * Logging
 * @type {winston}
 *****************/
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;
const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} <${level}> ${message} </${level}>`;
});
let today = new Date().toLocaleDateString("en-US", {timeZone: "America/New_York"});
let todayFormatted = today.substring(0, 10).replace(/\//g, "-");
const logger = createLogger({
  format: combine(
    timestamp({
      format: 'MM/DD/YYYY, hh:mm:ss A Z'
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
  let  data = patientSample.data? patientSample.data[0] : patientSample;
  return data.meta.find(m => m.key === constants.META.NUM_ATTEMPTS).value;
}

function getPerformed(patientSample){
  let data = patientSample.data? patientSample.data[0] : patientSample;
  return data.meta.find(m => m.key === constants.META.PERFORMED).value;
}

function getSampleID(patientSample){
  return patientSample.data? patientSample.data[0].sampleID : patientSample.sampleID;
}

function getSampleTypeID(patientSample){
  return patientSample.data? patientSample.data[0].sampleTypeID : patientSample.sampleTypeID;
}

function getChildren(pooledSample){
  return pooledSample.data? pooledSample.data[0].children : pooledSample.children;
}

function getParentID(patientSample){
  return patientSample.data? patientSample.data[0].parentSampleID : patientSample.parentSampleID;
}

function isChild(patientSample){
  return getSampleTypeID(patientSample) === config.get("covidSampleTypeID")
    && getPerformed(patientSample) === constants.POOLED.POOLED
    && getParentID(patientSample) !== "0";
}

function isParent(pooledSample){
  return getSampleTypeID(pooledSample) === config.get("pooledSampleTypeID") && pooledSample.data[0].children.length > 0;
}

function getMetasForSample(sampleObj, indMetas, poolMetas){
  return getSampleTypeID(sampleObj) === config.get('covidSampleTypeID')? indMetas : poolMetas;
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

function createMetaObj({key, value, type, metaID}={}){
  return   {
    "key": key,
    "value": value,
    "sampleDataType": type,
    "sampleTypeMetaID": metaID
  }
}

function validChildren(children, sampleBC){
  // check that all children are of COVID-19 sampleType
  const nonCOVID = children.some(child => child.sampleTypeID !== config.get('covidSampleTypeID'));
  if(nonCOVID){
    logger.error(`Not all children of pooled sample ${sampleBC} are of sample type COVID-19 Sample. 
                    Results for sampleBC ${sampleBC} NOT processed.`);
    return false;
  }

  // check that all the children as performed as "pooled"
  const nonPooled = children.some(child => getPerformed(child) !== constants.POOLED.POOLED);
  if(nonPooled){
    logger.error(`Not all children of pooled sample ${sampleBC} are Performed as "pooled". 
                    Results for sampleBC ${sampleBC} NOT processed.`);
    return false;
  }

  return true;
}

function isValidLogSample(sampleObj, sampleBC){
  const sampleTypeID = getSampleTypeID(sampleObj);
  if (sampleTypeID !== config.get('covidSampleTypeID') && sampleTypeID !== config.get('pooledSampleTypeID')){
    logger.error(`Unrecognized SampleTypeID ${sampleTypeID}. SAMPLE BC:${sampleBC} NOT PROCESSED.`);
    return false;
  }

  if (sampleTypeID === config.get('covidSampleTypeID' && getPerformed(sampleObj) === constants.POOLED.POOLED)){
    logger.error(`SAMPLE BC:${sampleBC} is a COVID-19 Sample and performed as "pooled" and thus should not appear in the 
                log. SAMPLE BC:${sampleBC} NOT PROCESSED.`);
    return false;
  }

  return true;
}


/******************
 * ELAB API CALLS
 ******************/

/**
 * Updates an array of meta fields for a sample
 * @param sampleID The unique ID of the sample generated by eLabs
 * @param metaArray an array of meta objects
 * @param retries Retry API call up to 5 (default) times
 * @returns {Promise<void>}
 */
async function updateMetas(sampleID, metaArray, retries=5){

  return axios
    .put(`${config.get('endpoints.samples')}/${sampleID}/metas`, metaArray, {timeout: timeout})
    .then((res) => {

      if(res.status === 200){
        logger.info(`Batch update sample: ${sampleID}, statusCode: ${res.status}.`);
      } else {
        if(retries > 0){
          logger.error(`Error occurred during metas update for sampleID ${sampleID}, statusCode: ${res.status}. Trying again.`);
          return updateMetas(sampleID, metaArray, retries - 1);
        } else {
          logger.error(`Failed to batch update sample after 5 attempts; Error: ${res.data}. 
                        SAMPLE ID:${sampleID} NOT CORRECTLY PROCESSED.`);
          process.exitCode = 8;
          return null;
        }
      }
    })
    .catch((error) => {
      if(retries > 0){
        logger.error(`Error occurred during metas update for sampleID ${sampleID}. Trying again.`);
        return updateMetas(sampleID, metaArray, retries - 1);
      } else {
        if (ax.isCancel(error)) {
          logger.error(`Request cancelled after 5 attempts, ${error}`);
        }
        else if(error.response){
          logger.error(`Failed to batch update sample after 5 attempts: ${sampleID}; Status: ${error.response.status}. 
                        StatusText: ${error.response.statusText}. Error Message: ${error.response.data}.
                        SAMPLE ID:${sampleID} NOT CORRECTLY PROCESSED.`);
        } else {
          logger.error(`Failed to batch update meta field after 5 attempts. Possible internal network error. Try again later.`);
          logger.error(`Error dump: ${error}`);
        }
        process.exitCode = 8;
        return null;
      }
    });
}

/**
 * Find a sample with the given barcode (which is also its name)
 * Returns null if more than one sample can be found with the same barcode
 * @param barcode Name of the sample
 * @param prefetch Boolean, returns error codes for Hamilton if true
 * @param retries Retry API call up to 5 (default) times
 * @returns {Promise<void>} Sample object with all custom fields if found, else Null
 */
async function getPatientSample(barcode, prefetch=false, retries=5){

  let endpoint = `${config.get('endpoints.samples')}` +
    `?$expand=meta%2Cchildren&name=${barcode}`;

  return axios.get(endpoint, {timeout: timeout})
    .then((res) => {
      if(res.status === 200){
        if(res.data.data.length === 0){
          logger.error(`Sample for barcode ID ${barcode} not found. SAMPLE BC:${barcode} NOT PROCESSED.`);
          process.exitCode = 8;
          return (prefetch? 'NOT FOUND' : null);
        }
        else if(res.data.data.length === 1){
          logger.info(`Got sample with barcode ${barcode}, statusCode: ${res.status}`);
          return res.data;
        } else {
          logger.error(`More than one sample found with name ${barcode}. SAMPLE BC:${barcode} NOT PROCESSED.`);
          process.exitCode = 8;
          return (prefetch? 'DUPLICATE' : null);
        }
      } else{
        if(retries > 0){
          logger.error(`Error occurred during getting sample ${barcode}, statusCode: ${res.status}. Trying again.`);
          return getPatientSample(barcode, prefetch, retries-1);
        } else {
          logger.error(res.data);
          process.exitCode = 8;
          return (prefetch? 'ERROR' : null);
        }
      }
    })
    .catch((error) => {
      if(retries > 0){
        logger.error(`Error occurred while getting sample ${barcode}. Trying again.`);
        return getPatientSample(barcode, prefetch, retries-1);
      } else {
        if (ax.isCancel(error)) {
          logger.error(`Request cancelled after 5 attempts, ${error}`);
        }
        else if(error.response){
          logger.error(`Failed to get sample after 5 attempts. Status: ${error.response.status}. 
                      StatusText: ${error.response.statusText}. Error Message: ${error.response.data}.
                      SAMPLE BC:${barcode} NOT PROCESSED.`);
        } else {
          logger.error(`Failed to get sample after 5 attempts. Possible internal network error. Try again later.`);
          logger.error(`Error dump: ${error}`);
        }
        process.exitCode = 8;
        return (prefetch? 'ERROR' : null);
      }
    });
}

/**
 * Get all the meta fields for SampleType
 * @param sampleTypeID either COVID-19 Sample or Pooled COVID-19 Sample, see config for IDs
 * @param retries Retry API call up to 5 (default) times
 * @returns {Promise<T>}
 */
async function getSampleTypeMetas(sampleTypeID, retries=5){

  return axios.get(`${config.get('endpoints.sampleTypes')}/${sampleTypeID}/meta`, {timeout: timeout})
    .then((res) => {
      if(res.status === 200){
        logger.info(`Got SampleType, statusCode: ${res.status}`);
        return res.data.data;
      } else {
        if(retries > 0){
          logger.error(`Error occurred while getting SampleType, statusCode: ${res.status}. Trying again`);
          return getSampleTypeMetas(retries-1);
        } else {
          logger.error(`Failed to get SampleType after 5 attempts. Status code: ${res.status}`);
          process.exitCode = 8;
          return null;
        }
      }
    })
    .catch((error) => {
      if(retries > 0){
        logger.error("Error occurred while getting SampleType. Trying again");
        return getSampleTypeMetas(retries-1);
      } else {
        if (ax.isCancel(error)) {
          logger.error(`Request to fetch SampleType cancelled after 5 attempts, ${error}`);
        }
        else if(error.response){
          logger.error(`Failed to find SampleType after 5 attempts. Status: ${error.response.status}. 
                        StatusText: ${error.response.statusText}. Error Message: ${error.response.data}.`);
        } else {
          logger.error(`Failed to get SampleType after 5 attempts. Possible internal network error. Try again later.`);
          logger.error(`Error dump: ${error}`);
        }
        process.exitCode = 8;
        return null;
      }
    });
}



/******************************
 * HAMILTON RELATED FUNCTIONS
 ******************************/

/**
 * Update Covid-19 Sample with the plate barcode and well number
 * from the Sample Prep Hamilton and update status
 * @param metas Array of meta fields associated with a SampleType
 * @param destBC Output plate barcode
 * @param destWellNum Output well number
 * @param user Technician initials
 * @param serialNum Serial number of the Hamilton robot
 * @returns {*} Array of meta objects to be updated
 */
function samplePrepTracking(metas, destBC, destWellNum, user, serialNum){
  let metaArray = [];

  const dwBC = metas.find(m => m.key === constants.META.DEEPWELL_BC);
  metaArray.push(createMetaObj({
    key: constants.META.DEEPWELL_BC,
    value: destBC,
    type: dwBC.sampleDataType,
    metaID: dwBC.sampleTypeMetaID})); //update RNA Plate Barcode

  const dwWN = metas.find(m => m.key === constants.META.DEEPWELL_WELL_NUM);
  metaArray.push(createMetaObj({
    key: constants.META.DEEPWELL_WELL_NUM,
    value: destWellNum,
    type: dwWN.sampleDataType,
    metaID: dwWN.sampleTypeMetaID})); //update RNA Plate Well Location

  const status = metas.find(m => m.key === constants.META.STATUS);
  metaArray.push(createMetaObj({
    key: constants.META.STATUS,
    value: constants.STATUS_VAL.SAMPLE_PREP_DONE,
    type: status.sampleDataType,
    metaID: status.sampleTypeMetaID})); //update status to "Sample Transferred To 96-Well Plate"

  const userMeta = metas.find(meta => meta.key === constants.META.SAMPLE_PREP_TECH);
  metaArray.push(createMetaObj({
    key: constants.META.SAMPLE_PREP_TECH,
    value: user,
    type: userMeta.sampleDataType,
    metaID: userMeta.sampleTypeMetaID})); //update initials of "Sample Aliquot User"

  const snMeta = metas.find(meta => meta.key === constants.META.SAMPLE_PREP_SN);
  metaArray.push(createMetaObj({
    key: constants.META.SAMPLE_PREP_SN,
    value: serialNum,
    type: snMeta.sampleDataType,
    metaID: snMeta.sampleTypeMetaID})); //update "Sample Aliquot Instrument SN"

  return metaArray;
}

/**
 * Updates Covid-19 Sample with the plate barcode and well number
 * from the RNA Extraction Hamilton and update status
 * @param metas Array of meta fields associated with a SampleType
 * @param destBC Output plate barcode
 * @param destWellNum Output well number
 * @param user Technician initials
 * @param serialNum Serial number of the Hamilton robot
 * @returns {*} Array of meta objects to be updated
 */
function rnaExtractionTracking(metas, destBC, destWellNum, user, serialNum){
  let metaArray = [];

  const rnaBC = metas.find(m => m.key === constants.META.RNA_PLATE_BC);
  metaArray.push(createMetaObj({
    key: constants.META.RNA_PLATE_BC,
    value: destBC,
    type: rnaBC.sampleDataType,
    metaID: rnaBC.sampleTypeMetaID})); //update RNA Plate Barcode

  const rnaWN = metas.find(m => m.key === constants.META.RNA_PLATE_WELL_NUM);
  metaArray.push(createMetaObj({
    key: constants.META.RNA_PLATE_WELL_NUM,
    value: destWellNum,
    type: rnaWN.sampleDataType,
    metaID: rnaWN.sampleTypeMetaID})); //update RNA Plate Well Location

  const status = metas.find(m => m.key === constants.META.STATUS);
  metaArray.push(createMetaObj({
    key: constants.META.STATUS,
    value: constants.STATUS_VAL.RNA_DONE,
    type: status.sampleDataType,
    metaID: status.sampleTypeMetaID})); //update status to "RNA Extracted"

  const userMeta = metas.find(meta => meta.key === constants.META.EXTRACTION_TECH);
  metaArray.push(createMetaObj({
    key: constants.META.EXTRACTION_TECH,
    value: user,
    type: userMeta.sampleDataType,
    metaID: userMeta.sampleTypeMetaID})); //update initials of "RNA Extraction User"

  const snMeta = metas.find(meta => meta.key === constants.META.EXTRACTION_SN);
  metaArray.push(createMetaObj({
    key: constants.META.EXTRACTION_SN,
    value: serialNum,
    type: snMeta.sampleDataType,
    metaID: snMeta.sampleTypeMetaID})); //update "RNA Extraction Instrument SN"

  return metaArray;
}

/**
 * Updates Covid-19 Sample with the plate barcode and well number
 * from the qPCR Prep Hamilton and update status
 * @param metas Array of meta fields associated with a SampleType
 * @param destBC Output plate barcode
 * @param destWellNum Output well number
 * @param user Technician initials
 * @param serialNum Serial number of the Hamilton robot
 * @returns {*} Array of meta objects to be updated
 */
function qPCRPrepTracking(metas, destBC, destWellNum, user, serialNum){
  let metaArray = [];

  const pcrBC = metas.find(m => m.key === constants.META.QPCR_PLATE_BC);
  metaArray.push(createMetaObj({
    key: constants.META.QPCR_PLATE_BC,
    value: destBC,
    type: pcrBC.sampleDataType,
    metaID: pcrBC.sampleTypeMetaID})); //update RNA Plate Barcode

  const pcrWN = metas.find(m => m.key === constants.META.QPCR_PLATE_WELL_NUM);
  metaArray.push(createMetaObj({
    key: constants.META.QPCR_PLATE_WELL_NUM,
    value: destWellNum,
    type: pcrWN.sampleDataType,
    metaID: pcrWN.sampleTypeMetaID})); //update RNA Plate Well Location

  const status = metas.find(meta => meta.key === constants.META.STATUS);
  metaArray.push(createMetaObj({
    key: constants.META.STATUS,
    value: constants.STATUS_VAL.QPCR_PREP_DONE,
    type: status.sampleDataType,
    metaID: status.sampleTypeMetaID})); //update status to "qPCR Reactions Prepared"

  const userMeta = metas.find(meta => meta.key === constants.META.QPCR_PREP_TECH);
  metaArray.push(createMetaObj({
    key: constants.META.QPCR_PREP_TECH,
    value: user,
    type: userMeta.sampleDataType,
    metaID: userMeta.sampleTypeMetaID})); //update initials of "qPCR Prep User"

  const snMeta = metas.find(meta => meta.key === constants.META.QPCR_PREP_SN);
  metaArray.push(createMetaObj({
    key: constants.META.QPCR_PREP_SN,
    value: serialNum,
    type: snMeta.sampleDataType,
    metaID: snMeta.sampleTypeMetaID})); //update "qPCR Prep Instrument SN"

  return metaArray;
}

/**
 * Updates a Covid-19 Sample with the reagent lot number it was processed with
 * @param metas Array of meta fields associated with a SampleType
 * @param reagentNames Array of reagent names used
 * @param reagentNums Array of reagent lot numbers, matches the names by index
 * @returns {*} Array of meta objects to be updated
 */
function reagentTracking(metas, reagentNames, reagentNums){
  reagentNames = stringToArray(reagentNames);
  reagentNums = stringToArray(reagentNums);

  let metaArray = [];
  for (let i = 0; i < reagentNames.length; i++) {
    const reagentMeta = metas.find(meta => meta.key === reagentNames[i]);
    if(reagentMeta){
      metaArray.push(createMetaObj({key: reagentNames[i],
        value: reagentNums[i],
        type: reagentMeta.sampleDataType,
        metaID: reagentMeta.sampleTypeMetaID})); //Update reagent lot number
    } else {
      logger.error(`Reagent field ${reagentNames[i]} cannot be found.`);
      process.exitCode = 8;
    }
  }

  return metaArray;
}

/**
 * Calls the appropriate update function based on Hamilton protocol
 * @param metas Array of meta fields associated with a SampleType
 * @param protocol A string indicating which robot the log originated from
 * @param destBC Output plate barcode
 * @param destWellNum Output well number
 * @param user Technician initials
 * @param serialNum Serial number of the Hamilton robot
 * @returns {*} Array of meta objects to be updated
 */
function lineageTracking(metas, protocol, destBC, destWellNum, user, serialNum){
  switch(protocol){
    case constants.ORIGIN_VAL.SAMPLE_ALIQUOT:
      return samplePrepTracking(metas, destBC, destWellNum, user, serialNum);
    case constants.ORIGIN_VAL.RNA_EXTRACTION:
      return rnaExtractionTracking(metas, destBC, destWellNum, user, serialNum);
    case constants.ORIGIN_VAL.QPCR_PREP:
      return qPCRPrepTracking(metas, destBC, destWellNum, user, serialNum);
  }
}

/**
 * Get data from each row of the Hamilton log and calls the appropriate function
 * to update eLabs records
 * @param csvRow
 * @param indMetas Array of meta fields associated with the COVID-19 SampleType
 * @param poolMetas Array of meta fields associated with the Pooled COVID-19 SampleType
 * @returns {Promise<void>}
 */
async function hamiltonTracking(csvRow, indMetas, poolMetas){
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

  if(!isValidLogSample(sampleObj)){
    process.exitCode = 8;
    return;
  }
  let metas = getMetasForSample(sampleObj, indMetas, poolMetas);

  let metaArray = []; //so we can update all the fields from the csv row in one API call
  let reagentNames = csvRow[constants.HAMILTON_LOG_HEADERS.REAGENT_NAMES];
  let reagentNums = csvRow[constants.HAMILTON_LOG_HEADERS.REAGENT_NUMS];
  metaArray.push(...reagentTracking(metas, reagentNames, reagentNums));

  let destBC = csvRow[constants.HAMILTON_LOG_HEADERS.DEST_BC];
  let destWellNum = csvRow[constants.HAMILTON_LOG_HEADERS.DEST_WELL_NUM];
  let user = csvRow[constants.HAMILTON_LOG_HEADERS.USER];
  let serialNum = csvRow[constants.HAMILTON_LOG_HEADERS.SERIAL_NUM];
  metaArray.push(...lineageTracking(metas, protocol, destBC, destWellNum, user, serialNum));

  // if qPCR prep && sampleType is pooled, then update all children
  if(protocol === constants.ORIGIN_VAL.QPCR_PREP && getSampleTypeID(sampleObj) === config.get('pooledSampleTypeID')){
    let children = getChildren(sampleObj);
    if(!validChildren(children, sampleBC)){
      process.exitCode = 8;
      return;
    }
    for(const child of children){
      let childMetaArr = [];
      const childID = child.sampleID;
      childMetaArr.push(...reagentTracking(indMetas, reagentNames, reagentNums));
      childMetaArr.push(...lineageTracking(metas, protocol, destBC, destWellNum, user, serialNum));
      await updateMetas(childID, childMetaArr);
    }
  }

  let sampleID = getSampleID(sampleObj);
  return Promise.resolve(updateMetas(sampleID, metaArray));
}


/********************************
 * QUANTSTUDIO RELATED FUNCTIONS
 ********************************/

/**
 * Increases number of attempt by 1 if allowed and returns the total number of attempts
 * @param sampleObj data object of the sample from eLab
 * @param metas Array of meta fields associated with a SampleType
 * @returns {*} Meta object for number of attempts
 */
function increaseAttempt(sampleObj, metas){
  // Check number of attempts
  let numAttempt = getNumAttempts(sampleObj);
  if (numAttempt < constants.MAX_ATTEMPTS){
    ++numAttempt; //Increase number of attempts by 1
  }

  const attemptMeta = metas.find(m => m.key === constants.META.NUM_ATTEMPTS);
  return createMetaObj({key: constants.META.NUM_ATTEMPTS,
    value: numAttempt,
    type: attemptMeta.sampleDataType,
    metaID: attemptMeta.sampleTypeMetaID});
}

/**
 * Updates status and result of samples that belong to the plate which had a failed control
 * @param metas Array of meta fields associated with a SampleType
 * @param statusConst Either "Re-run qPCR" or "Re-run RNA Extraction"
 * @param numAttempt Number of attempts for this sample
 * @param isParent
 * @returns {*} Array of meta objects to be updated
 */
function updateFailed(metas, statusConst, numAttempt, isParent=false){
  let metaArray = [];
  const result = metas.find(m => m.key === constants.META.RESULT);
  const status = metas.find(m => m.key === constants.META.STATUS);

  // If it's less than 5, we can rerun
  if (numAttempt < constants.MAX_ATTEMPTS){
    metaArray.push(createMetaObj({key: constants.META.RESULT,
      value: constants.TEST_RESULT.WARNING,
      type: result.sampleDataType,
      metaID: result.sampleTypeMetaID})); //update Test Result to "Control Failed"

    metaArray.push(createMetaObj({key: constants.META.STATUS,
      value: statusConst,
      type: status.sampleDataType,
      metaID: status.sampleTypeMetaID})); // Update status to re-prep or re-extract
  } else {
    metaArray.push(createMetaObj({key: constants.META.RESULT,
      value: constants.TEST_RESULT.INVALID,
      type: result.sampleDataType,
      metaID: result.sampleTypeMetaID})); //Update Test Result to "Invalid - recollect"

    if(isParent){
      metaArray.push(createMetaObj({key: constants.META.STATUS,
        value: constants.STATUS_VAL.QPCR_COMPLETE,
        type: status.sampleDataType,
        metaID: status.sampleTypeMetaID})); //update status to "qPCR Completed"
    } else {
      metaArray.push(createMetaObj({key: constants.META.STATUS,
        value: constants.STATUS_VAL.QPCR_DONE,
        type: status.sampleDataType,
        metaID: status.sampleTypeMetaID})); //update status to "Finished"
    }
  }

  return metaArray;
}

/**
 * Updates status and result of samples that did not fail its control sample
 * @param metas Array of meta fields associated with a SampleType
 * @param call Result of the well from the Call column of the qPCR output
 * @param isParent Boolean for if the sample is a pooled parent
 * @param isChild Boolean for if the sample is a pooled child
 * @returns {*} Array of meta objects to be updated
 */
function updatePassed(metas, call, isParent=false, isChild=false){
  let metaArray = [];

  let callVal = constants.TEST_RESULT[call];
  let isPos = call === 'POSITIVE';
  let isInvalid = call === 'INVALID';

  if(isPos && (isParent || isChild)){
    callVal =  constants.POOLED.POSITIVE;
  }
  const result = metas.find(m => m.key === constants.META.RESULT);
  metaArray.push(createMetaObj({key: constants.META.RESULT,
    value: callVal,
    type: result.sampleDataType,
    metaID: result.sampleTypeMetaID})); //update Test Result

  let statusVal = constants.STATUS_VAL.QPCR_DONE;
  if (isParent || (isChild && isInvalid) || (isChild && isPos)){
    statusVal = constants.STATUS_VAL.QPCR_COMPLETE;
  }
  const status = metas.find(m => m.key === constants.META.STATUS);
  metaArray.push(createMetaObj({key: constants.META.STATUS,
    value: statusVal,
    type: status.sampleDataType,
    metaID: status.sampleTypeMetaID})); //update Status

  if(isChild){
    const performed = metas.find(m => m.key === constants.META.PERFORMED);
    metaArray.push(createMetaObj({key: constants.META.PERFORMED,
      value: constants.POOLED.INDIVIDUAL,
      type: performed.sampleDataType,
      metaID: performed.sampleTypeMetaID})); //set Performed to Individual
  }

  return metaArray;
}

/**
 * Helper function for building metas for test results
 * @param sampleObj data object of the sample from eLab
 * @param metas Array of meta fields associated with a SampleType
 * @param failedWells Dictionary of all possible failed wells and their respective status
 * @param user Initials of the technician who initiated the qPCR run
 * @param serialNum Serial number of the qPCR machine
 * @param wellNum Well number from the Well Position column of the qPCR output
 * @param call Result of the well from the Call column of the qPCR output
 * @returns {Array}
 */
function buildResultMetas(sampleObj, metas,  failedWells, user, serialNum, wellNum, call){
  let metaArray = [];
  const userMeta = metas.find(meta => meta.key === constants.META.QPCR_TECH);
  metaArray.push(createMetaObj({
    key: constants.META.QPCR_TECH,
    value: user,
    type: userMeta.sampleDataType,
    metaID: userMeta.sampleTypeMetaID})); //update initials of "qPCR User"

  const snNumMeta = metas.find(meta => meta.key === constants.META.QPCR_SN);
  metaArray.push(createMetaObj({
    key: constants.META.QPCR_SN,
    value: serialNum,
    type: snNumMeta.sampleDataType,
    metaID: snNumMeta.sampleTypeMetaID})); //update "qPCR SN"

  let numAttemptMetaObj = increaseAttempt(sampleObj, metas);
  metaArray.push(numAttemptMetaObj);

  if (wellNum in failedWells){
    metaArray.push(...updateFailed(metas, failedWells[wellNum], numAttemptMetaObj.value, isParent(sampleObj)));
  } else {
    metaArray.push(...updatePassed(metas, call, isParent(sampleObj), isChild(sampleObj)));
  }

  return metaArray;
}

/**
 * Main function for updating data from the Well Call file
 *
 * Update "call" of the test, results can be POSITIVE, NEGATIVE, INVALID, INCONCLUSIVE, or WARNING
 * INVALID or INCONCLUSIVE results both require recollection of sample
 * WARNING occurs when controls failed, and can be reattempted up to 4 more times
 * If controls fail during attempt #5, a recollection is required
 * @param csvRow
 * @param indMetas Array of meta fields associated with the COVID-19 SampleType
 * @param poolMetas Array of meta fields associated with the Pooled COVID-19 SampleType
 * @param failedWells Dictionary of all possible failed wells and their respective status
 * @param user Initials of the technician who initiated the qPCR run
 * @param serialNum Serial number of the qPCR machine
 * @returns {Promise<void>}
 */
async function updateTestResult(csvRow, indMetas, poolMetas, failedWells, user, serialNum){
  let sampleBC = csvRow[constants.QPCR_LOG_HEADERS.SAMPLE];
  if (isControl(sampleBC)) {
    return;
  }

  let sampleObj = await getPatientSample(sampleBC);
  if(!sampleObj){
    process.exitCode = 8;
    return;
  }

  if(!isValidLogSample(sampleObj)){
    process.exitCode = 8;
    return;
  }

  let metas = getMetasForSample(sampleObj, indMetas, poolMetas);

  let wellNum = csvRow[constants.QPCR_LOG_HEADERS.WELL];
  let call = csvRow[constants.QPCR_LOG_HEADERS.CALL];
  let metaArray = buildResultMetas(sampleObj, metas, failedWells, user, serialNum, wellNum, call);

  // update its children, if pooled
  if(isParent(sampleObj)){
    let children = getChildren(sampleObj);
    if(!validChildren(children, sampleBC)){
      process.exitCode = 8;
      return;
    }
    for(const child of children){
      const childID = child.sampleID;
      let childMetaArr = buildResultMetas(child, indMetas, failedWells, user, serialNum, wellNum, call);
      await updateMetas(childID, childMetaArr);
    }
  }

  let sampleID = getSampleID(sampleObj);
  return Promise.resolve(await updateMetas(sampleID, metaArray));
}

/**
 * Helper function for building metas for Cq targets
 * @param metas
 * @param target Name of the gene target
 * @param cq  CT value
 * @returns {{key, value, sampleDataType, sampleTypeMetaID}}
 */
function buildTargetMeta(metas, target, cq){
  const targetMeta = metas.find(m => m.key === constants.META[target]);
  return createMetaObj({key: constants.META[target],
    value: cq,
    type: targetMeta.sampleDataType,
    metaID: targetMeta.sampleTypeMetaID});
}

/**
 * Main function for updating data from the Target Call file
 *
 * Updates PatientSample with CT values from the QuantStudio. Stores CT values
 * internally until all 3 have been read, then writes them at once to eLab.
 * @param csvRow
 * @param indMetas Array of meta fields associated with the COVID-19 SampleType
 * @param poolMetas Array of meta fields associated with the Pooled COVID-19 SampleType
 * @param allSampleCTs dictionary of eLab sampleID to array of CT value meta objects
 * @returns {Promise<void>}
 */
async function updateCTValues(csvRow, indMetas, poolMetas, allSampleCTs){
  let sampleBC = csvRow[constants.QPCR_LOG_HEADERS.SAMPLE];
  if (isControl(sampleBC)) {
    return;
  }

  let sampleObj = await getPatientSample(sampleBC);
  if(!sampleObj){
    process.exitCode = 8;
    return;
  }

  if(!isValidLogSample(sampleObj)){
    process.exitCode = 8;
    return;
  }

  let metas = getMetasForSample(sampleObj, indMetas, poolMetas);

  if(!(sampleBC in allSampleCTs)){
    allSampleCTs[sampleBC] = [];
  }

  let target = csvRow[constants.QPCR_LOG_HEADERS.TARGET];
  let cq = csvRow[constants.QPCR_LOG_HEADERS.CQ];
  allSampleCTs[sampleBC].push(buildTargetMeta(metas, target, cq));

  // update record when all 3 records are processed
  if(allSampleCTs[sampleBC].length === 3){
    let sampleID = getSampleID(sampleObj);
    await updateMetas(sampleID, allSampleCTs[sampleBC]);

    // and update its children, if pooled
    if(getSampleTypeID(sampleObj) === config.get('pooledSampleTypeID')){
      let children = getChildren(sampleObj);
      if(!validChildren(children, sampleBC)){
        process.exitCode = 8;
        return;
      }
      for(const child of children){
        const childID = child.sampleID;
        let childMetaArr = allSampleCTs[sampleBC].map(parentMeta =>
          buildTargetMeta(indMetas, parentMeta["key"].substring(10, 12), parentMeta["value"])
        );
        await updateMetas(childID, childMetaArr);
      }
    }
  }

  return Promise.resolve(true);
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
 * Returns the eLab ID for the given row's barcode
 * or a string indicating error
 * @param csvRow
 * @returns {Promise<any>}
 */
async function getElabID(csvRow){
  let sampleBC = csvRow[constants.HAMILTON_LOG_HEADERS.SAMPLE_TUBE_BC];
  let sampleObj = await getPatientSample(sampleBC, true);

  let sampleID;
  if (typeof sampleObj === 'string'){
    sampleID = sampleObj;
  } else {
    sampleID = getSampleID(sampleObj)
  }

  return Promise.resolve(sampleID);
}

/**
 * Handles parsing of all Hamilton and QuantStudio CSV output
 * @param logfile Output from Hamilton or QuantStudio
 * @param failedWells Dictionary of all possible failed wells and their respective status
 * @param qPCRUser Required for Well Call file
 * @param qPCRSerialNum Required for Well Call file
 */
async function parseCSV(logfile, failedWells, qPCRUser, qPCRSerialNum){
  let allSampleCTs = {};
  let write = false;
  let promises = [];
  let idRows = [[constants.HAMILTON_LOG_HEADERS.SAMPLE_TUBE_BC, constants.HAMILTON_LOG_HEADERS.ELAB_ID]];

  let indMetas = await getSampleTypeMetas(config.get('covidSampleTypeID'));
  if (!indMetas){
    logger.error(`Error occurred when getting COVID-19 SampleType. NO SAMPLE IN LOGFILE:${logfile} WAS PROCESSED.`);
    process.exitCode = 8;
    return;
  }

  let poolMetas = await getSampleTypeMetas(config.get('pooledSampleTypeID'));
  if (!poolMetas){
    logger.error(`Error occurred when getting Pooled SampleType. NO SAMPLE IN LOGFILE:${logfile} WAS PROCESSED.`);
    process.exitCode = 8;
    return;
  }


  let parser = csv.parseFile(logfile, {
    headers:true,
    comment:"#", //ignore lines that begin with #
    skipLines:2 }
  )
    .on('data', (row) => {
      // DO NOT CHANGE ORDER
      if (Object.keys(row).includes(constants.HAMILTON_LOG_HEADERS.PROTOCOL)){
        promises.push(hamiltonTracking(row, indMetas, poolMetas));
      } else if (Object.keys(row).includes(constants.HAMILTON_LOG_HEADERS.SAMPLE_TUBE_BC)){
        write = true;
        let p = getElabID(row).then((elabID) => {
            idRows.push({
              [constants.HAMILTON_LOG_HEADERS.SAMPLE_TUBE_BC]: row[constants.HAMILTON_LOG_HEADERS.SAMPLE_TUBE_BC],
              [constants.HAMILTON_LOG_HEADERS.ELAB_ID]: elabID
            });
        });
        promises.push(p);
      } else if (Object.keys(row).includes(constants.QPCR_LOG_HEADERS.CQ)){
        parser.pause();
        let p = updateCTValues(row, indMetas, poolMetas, allSampleCTs).then(() => {
          parser.resume();
        });
        promises.push(p);
      } else if (Object.keys(row).includes(constants.QPCR_LOG_HEADERS.CALL)){
        promises.push(updateTestResult(row, indMetas, poolMetas, failedWells, qPCRUser, qPCRSerialNum));
      }
    })
    .on('error', (error) => {
      logger.error(error);
      process.exitCode = 8;
      parser.end();
    })
    .on('end', (rowCount) => {
      Promise.all(promises).then(() => {
        logger.info(`Parsed ${rowCount} records`);
        if (write) {
          // overwrite the original logfile
          logger.info(`Writing eLab IDs to file`);
          csv.writeToPath(logfile, idRows);
          process.exitCode = 14;
        }
      });
    });
}

async function main(logfile){
  logger.info(logfile);
  logger.error(`**${logfile}**`);

  let token = config.get('authToken');
  if (isEmpty(token)){
    logger.error(`No authentication token found in config. NO SAMPLE IN LOGFILE:${logfile} WAS PROCESSED.`);
    process.exitCode = 8;
    return;
  }
  axios.defaults.headers.common['Authorization'] = token;

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

  parseCSV(logfile, failedWells, qPCRUser, qPCRSerialNum);
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
