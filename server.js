// Author: Dany Fu (danyfu@bu.edu)

const axios = require("axios").default;
const csv = require("fast-csv");
const fs = require("fs");
const argv = require("minimist")(process.argv.slice(2));
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  transports: [
    // - Write all logs with level `error` and below to `error.log`
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // - Write all logs with level `info` and below to `combined.log`
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
const constants = require("./constants.js");


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function equalsIgnoringCase(text, other) {
  return text.localeCompare(other, undefined, { sensitivity: 'accent' }) === 0;
}

function getNumAttempts(patientSample){
  return patientSample.data[0].meta.find(m => m.key === constants.META.NUM_ATTEMPTS).value;
}

function getSampleId(patientSample){
  return patientSample.data[0].sampleID;
}

/******************
 * ELABS API CALLS
 ******************/

/**
 * Authentication; this function must occur before any other API calls can be made
 * @param username
 * @param password
 * @returns {Promise<T>} A token is returned if the login is successful
 */
async function login(username, password) {
  username = "danyfu@bu.edu";
  password = "foobar";

  return axios
    .post(constants.ENDPOINTS.LOGIN, {
      username: username,
      password: password,
    })
    .then((res) => {
      logger.info(`Authentication status code: ${res.status}`);
      if(res.status === 200){
        axios.defaults.headers.common['Authorization'] = res.data.token;
      }
      return res.status;
    })
    .catch((error) => {
      logger.error(error);
      process.exitCode = 8;
      return null;
    });
}

/**
 * Update a custom field for a sample
 * @param sampleId The unique ID of the sample generated by eLabs
 * @param key Name of the field to be updated
 * @param value Value of the field to be updated
 * @param type The field type (dropdown, text, radio button, etc)
 * @param metaId The sampleTypeMetaID
 * @returns {Promise<void>}
 */
async function updateMeta({sampleId, key, value, type, metaId}={}){
  return axios
    .put(`https://us.elabjournal.com/api/v1/samples/${sampleId}/meta`, {
      key: key,
      value: value,
      sampleDataType: type,
      sampleTypeMetaID: metaId
    })
    .then((res) => {
      if(res.status === 200){
        logger.info(`Update sample: ${sampleId}, field:${key}, statusCode: ${res.status}`);
      } else {
        logger.error(res.data);
        process.exitCode = 8;
      }
    })
    .catch((error) => {
      logger.error(error);
      process.exitCode = 8;
    });
}

/**
 * Return all Patient Samples and their meta fields that matches a search term
 * @param searchTerm
 * @returns {Promise<void>}
 */
async function searchForPatienSample(searchTerm){
  return axios.get(`${constants.ENDPOINTS.GET_PATIENT_SAMPLE}&search=${searchTerm}`)
    .then((res) => {
      logger.info(`statusCode: ${res.status}`);
      return res.data;
    })
    .catch((error) => {
      logger.error(error);
      process.exitCode = 8;
      return null;
    });
}

/**
 * Find a Patient Sample with the given barcode (which is also its name)
 * Returns null if more than one sample can be found with the same barcode
 * @param barcode Name of the sample
 * @returns {Promise<void>} Sample object with all custom fields if found, else Null
 */
async function getPatientSample(barcode){
  return axios.get(`${constants.ENDPOINTS.GET_PATIENT_SAMPLE}&name=${barcode}`)
    .then((res) => {
      if(res.status === 200){
        if(res.data.data.length === 1){
          logger.info(`Got sample with barcode ${barcode}, statusCode: ${res.status}`);
          return res.data;
        } else {
          logger.error(`More than one sample found with name ${barcode}`);
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
      logger.error(error);
      process.exitCode = 8;
      return null;
    });
}






/******************************
 * HAMILTON RELATED FUNCTIONS
 ******************************/

/**
 * Update PatientSample with the plate barcode and well number
 * from the Sample Prep Hamilton and update status
 * @param sampleID
 * @param destBC
 * @param destWellNum
 * @returns {Promise<void>}
 */
async function samplePrepTracking(sampleID, destBC, destWellNum){
  updateMeta({sampleId:sampleID,
    key: constants.META.DEEPWELL_BC.KEY,
    value: destBC,
    type: constants.META.DEEPWELL_BC.TYPE,
    metaId: constants.META.DEEPWELL_BC.META_ID}); //update RNA Plate Barcode
  updateMeta({sampleId:sampleID,
    key: constants.META.DEEPWELL_WELL_NUM.KEY,
    value: destWellNum,
    type: constants.META.DEEPWELL_WELL_NUM.TYPE,
    metaId: constants.META.DEEPWELL_WELL_NUM.META_ID}); //update RNA Plate Well Location
  updateMeta({sampleId:sampleID,
    key: constants.META.STATUS.KEY,
    value: constants.STATUS_VAL.SAMPLE_PREP_DONE,
    type: constants.META.STATUS.TYPE,
    metaId: constants.META.STATUS.META_ID}); //update status to "Sample Transferred To 96-Well Plate"
}

/**
 * Updates PatientSample with the plate barcode and well number
 * from the RNA Extraction Hamilton and update status
 * @param sampleID
 * @param destBC
 * @param destWellNum
 * @returns {Promise<void>}
 */
async function rnaExtractionTracking(sampleID, destBC, destWellNum){
  updateMeta({sampleId:sampleID,
    key: constants.META.RNA_PLATE_BC.KEY,
    value: destBC,
    type: constants.META.RNA_PLATE_BC.TYPE,
    metaId: constants.META.RNA_PLATE_BC.META_ID}); //update RNA Plate Barcode
  updateMeta({sampleId:sampleID,
    key: constants.META.RNA_PLATE_WELL_NUM.KEY,
    value: destWellNum,
    type: constants.META.RNA_PLATE_WELL_NUM.TYPE,
    metaId: constants.META.RNA_PLATE_WELL_NUM.META_ID}); //update RNA Plate Well Location
  updateMeta({sampleId:sampleID,
    key: constants.META.STATUS.KEY,
    value: constants.STATUS_VAL.RNA_DONE,
    type: constants.META.STATUS.TYPE,
    metaId: constants.META.STATUS.META_ID}); //update status to "RNA Extracted"
}

/**
 * Updates PatientSample with the plate barcode and well number
 * from the qPCR Prep Hamilton and update status
 * @param sampleID
 * @param destBC
 * @param destWellNum
 * @returns {Promise<void>}
 */
function qPCRPrepTracking(sampleID, destBC, destWellNum){
  updateMeta({sampleId:sampleID,
              key: constants.META.QPCR_PLATE_BC.KEY,
              value: destBC,
              type: constants.META.QPCR_PLATE_BC.TYPE,
              metaId: constants.META.QPCR_PLATE_BC.META_ID}); //update qPCR Plate Barcode
  updateMeta({sampleId:sampleID,
              key: constants.META.QPCR_PLATE_WELL_NUM.KEY,
              value: destWellNum,
              type: constants.META.QPCR_PLATE_WELL_NUM.TYPE,
              metaId: constants.META.QPCR_PLATE_WELL_NUM.META_ID}); //update qPCR Plate Well Location
  updateMeta({sampleId:sampleID,
              key: constants.META.STATUS.KEY,
              value: constants.STATUS_VAL.QPCR_PREP_DONE,
              type: constants.META.STATUS.TYPE,
              metaId: constants.META.STATUS.META_ID}); //update status to "qPCR Reactions Prepared"
}

/**
 * Calls the appropriate update function based on Hamilton protocol
 * @param csvRow row in the CSV
 */
async function lineageTracking(csvRow){
  let protocol = csvRow[constants.HAMILTON_LOG_HEADERS.PROTOCOL];
  if (!protocol || (!(protocol in constants.ORIGIN_VAL))){
    let protocolVals = Object.keys(constants.ORIGIN_VAL);
    logger.error(`${protocol} is not recognized as a supported process. Must be one of the 
                  ${protocolVals.length} values: ${Object.keys(constants.ORIGIN_VAL)}. 
                  Index ${csvRow[constants.HAMILTON_LOG_HEADERS.INDEX]} not processed.`);
    process.exitCode = 8;
    return;
  }

  let sampleBC = csvRow[constants.HAMILTON_LOG_HEADERS.SAMPLE_TUBE_BC];
  let sampleObj = await getPatientSample(sampleBC);
  if(!sampleObj){
    logger.error(`Sample for barcode ID ${sampleBC} not found`);
    process.exitCode = 8;
    return;
  }

  let sampleID = getSampleId(sampleObj);
  let destBC = csvRow[constants.HAMILTON_LOG_HEADERS.DEST_BC];
  let destWellNum = csvRow[constants.HAMILTON_LOG_HEADERS.DEST_WELL_NUM];

  switch(protocol){
    case constants.ORIGIN_VAL.SAMPLE_PREP:
      samplePrepTracking(sampleID, destBC, destWellNum);
      break;
    case constants.ORIGIN_VAL.RNA_EXTRACTION:
      rnaExtractionTracking(sampleID, destBC, destWellNum);
      break;
    case constants.ORIGIN_VAL.QPCR_PREP:
      qPCRPrepTracking(sampleID, destBC, destWellNum);
      break;
  }
}


/********************************
 * QUANTSTUDIO RELATED FUNCTIONS
 ********************************/

/**
 * Update "call" of the test, results are POSITIVE, NEGATIVE, or INVALID
 * @param csvRow
 * @param qPCRPlateBC
 * @returns {Promise<void>}
 */
async function updateTestResult(csvRow, qPCRPlateBC){
  let result = csvRow[constants.CALL];
  updateMeta({sampleId:sampleID,
    key: constants.META.RESULT.KEY,
    value: result,
    type: constants.META.RESULT.TYPE,
    metaId: constants.META.RESULT.META_ID}); //update COVID-19 Test Result
  updateMeta({sampleId:sampleID,
    key: constants.META.STATUS.KEY,
    value: constants.STATUS_VAL.QPCR_DONE,
    type: constants.META.STATUS.TYPE,
    metaId: constants.META.STATUS.META_ID}); //update status to "qPCR Run"
}

/**
 * Updates PatientSample with CT values from the QuantStudio
 * @param csvRow
 * @param qPCRPlateBC
 * @returns {Promise<void>}
 */
async function updateCTValues(csvRow, qPCRPlateBC, sampleIdDict){
  let ctN1;
  let ctN2;
  let ctRP;
  let wellNum = csvRow[constants.QPCR_LOG_HEADERS.WELL];
  updateMeta({sampleId:sampleID,
    key: constants.META.CT_N1.KEY,
    value: ctN1,
    type: constants.META.CT_N1.TYPE,
    metaId: constants.META.CT_N1.META_ID}); //update N1 CT value
  updateMeta({sampleId:sampleID,
    key: constants.META.CT_N2.KEY,
    value: ctN2,
    type: constants.META.CT_N2.TYPE,
    metaId: constants.META.CT_N2.META_ID}); //update N2 CT value
  updateMeta({sampleId:sampleID,
    key: constants.META.CT_RP.KEY,
    value: ctRP,
    type: constants.META.CT_RP.TYPE,
    metaId: constants.META.CT_RP.META_ID}); //update Rnase P CT value
}

/**
 * Get the barcode of the plate by searching for "# Barcode: " in the QuantStudio output
 * @param logfile QuantStudio or Hamilton logfile
 * @returns {string} barcode of the qPCR plate, if found, else empty string
 */
function getqPCRPlateBC(logfile) {
  let barcode = "";
  let data = fs.readFileSync(logfile, 'utf8');
  const regex = /# Barcode: (.*)/g;
  let found = regex.exec(data);
  if(found){
    barcode = found[1];
  }
  return barcode;
}

async function parse_logfile(logfile){
  logger.info(`Logged: ${new Date().toLocaleString("en-US", {timeZone: "America/New_York"})}\n`);
  logger.info(logfile);

  let auth = await login();
  if (!auth || auth !== 200){
    logger.error(`Failed to log into eLabs.`);
    process.exitCode = 8;
    return;
  }

  let sampleIdDict = {};
  let qPCRPlateBC = getqPCRPlateBC(logfile);

  let readStream = fs.createReadStream(logfile);
  readStream.pipe(csv.parse({
      headers:true,
      comment:"#", //ignore lines that begin with #
      skipLines:2 })
    )
    .on('error', (error) => {
      logger.error(error);
      process.exitCode = 8;
      readStream.destroy();
    })
    .on('data', (row) => {
      if (Object.keys(row).includes(constants.HAMILTON_LOG_HEADERS.PROTOCOL)){
        lineageTracking(row);
      } else {
        if (qPCRPlateBC.length === 0){
          logger.error("No qPCR plate barcode was found");
          process.exitCode = 8;
          readStream.destroy();
        }

        if (Object.keys(row).includes(constants.QPCR_LOG_HEADERS.CQ)){
          updateCTValues(row, qPCRPlateBC, sampleIdDict);
        } else if (Object.keys(row).includes(constants.QPCR_LOG_HEADERS.CALL)){
          updateTestResult(row, qPCRPlateBC);
        }
      }

    })
    .on('end', (rowCount) => logger.info(`Parsed ${rowCount} records`));
}

/**
 * file: path of the CSV file to be parsed
 */
parse_logfile(argv.file);
process.on('exit', (code) => {
  console.log(`Exited with code ${code}`);
  logger.info(`Process exit event with code:${code}`);
});
