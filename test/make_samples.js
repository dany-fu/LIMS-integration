const { v4: uuidv4 } = require("uuid");
const axios = require("axios").default;
const csv = require("fast-csv");
const fs = require("fs");
const argv = require("minimist")(process.argv.slice(2));
const config = require('config');
const constants = require("../constants.js");

/*****************
 * Logging
 * @type {winston}
 *****************/
const winston = require('winston');
let today = new Date().toLocaleDateString("en-US", {timeZone: "America/New_York"});
let todayFormatted = today.substring(0, 10).replace(/\//g, "-");
const logger = winston.createLogger({
  level: 'info',
  transports: [
    // - Write all logs with level `error` and below to `error.log`
    new winston.transports.File({ filename: `test/error-${todayFormatted}.log`, level: 'error' }),
    // - Write all logs with level `info` and below to `combined.log`
    new winston.transports.File({ filename: `test/combined-${todayFormatted}.log` }),
  ],
});

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
      logger.error(`Failed to find sample type with message: ${error.response.data.message}
                    Error: ${error.response.data.errors}`);
      process.exitCode = 8;
      return null;
    });
}

function isEmpty(str) {
  return (!str || str.trim().length === 0);
}

async function init(){
  let token = config.get('authToken');
  if (isEmpty(token)){
    logger.error(`No authentication token found in config.`);
    process.exitCode = 8;
    return;
  }
  axios.defaults.headers.common['Authorization'] = token;

  return await getCovidSampleTypeMetas();
}

async function makeBatchSamples(){

  let metas = await init();
  if (!metas){
    logger.error(`No meta data.`);
    process.exitCode = 8;
    return null;
  }

  let plateRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  let plateCols = Array.from(Array(12), (_, i) => i + 1);
  let plate_coordinates_96 = [];
  for (let i = 0; i < plateRows.length; i++) {
    for (let j = 0; j < plateCols.length; j++) {
      plate_coordinates_96.push(`${plateRows[i]}${plateCols[j]}`);
    }
  }

  for (let i = 0; i < plate_coordinates_96.length; i++) {
    let sampleID = await makeSample();
    if (sampleID){
      qPCRPrepTracking(sampleID, "test-qpcr-bc", plate_coordinates_96[i], metas);
    }
  }
}

async function makeSample(name){
  if(!name){
    name = uuidv4();
  }
  return axios
    .post(config.get('endpoints.createSample'), {
      sampleTypeID: config.get('covidSampleTypeId'),
      name: name,
    })
    .then((res) => {
      logger.info(`Make sample statusCode: ${res.status}`);
      if (res.status === 200){
        logger.info(`New sample ID: ${res.data}`);
        return res.data;
      }
    })
    .catch((error) => {
      logger.error(`Failed to create sample: ${error.response.data.message}
                    Error: ${error.response.data.errors}`);
      process.exitCode = 8;
      return null;
    });
}

async function noActiveSample(barcode){
  let endpoint = `${config.get('endpoints.samples')}` +
    `?sampleTypeID=${config.get('covidSampleTypeId')}` +
    `&name=${barcode}`;

  return axios.get(endpoint)
    .then((res) => {
      if(res.status === 200){
        return res.data.data.length === 0;
      } else {
        logger.error(`Failed to get sample: ${barcode} with status: ${res.status}.`);
      }
    })
    .catch((error) => {
      logger.error(`Failed to get sample: ${barcode} with message: ${error.response.data.message}
                    Error: ${error.response.data.errors}. 
                    SAMPLE BC:${barcode} NOT PROCESSED.`);
      process.exitCode = 8;
      return null;
    });
}

async function deleteSample(sampleID){
  return axios.delete(`https://bu-acc.elabjournal.com/api/v1/samples/${sampleID}`)
    .then((res) => {
      if(res.status === 200){
        logger.info(`Deleted sample ${sampleID}`);
      } else {
        logger.error(`Failed to delete sample ${sampleID} with status: ${res.status}`);
      }
    })
    .catch((error) => {
      logger.error(`Failed to delete sample: ${sampleID} with message: ${error.response.data.message}
                    Error: ${error.response.data.errors}`);
      process.exitCode = 8;
      return null;
    });
}

async function makeSamplesFromLog(logfile){

  await init();

  let readStream = fs.createReadStream(logfile);
  readStream.pipe(csv.parse({
    headers:true,
    comment:"#", //ignore lines that begin with #
    skipLines:2 })
  )
    .on('error', (error) => {
      logger.error(error);
      process.exitCode = 8;
    })
    .on('data', async (row) => {
      let sampleBC = row[constants.HAMILTON_LOG_HEADERS.SAMPLE_TUBE_BC];
      if(await noActiveSample(sampleBC)){
        makeSample(sampleBC);
      }
    })
    .on('end', (rowCount) => logger.info(`Parsed ${rowCount} records`));
}

makeSamplesFromLog(argv.file);
//makeBatchSamples();

process.on('unhandledRejection', (reason, promise) => {
  process.exitCode = 8;
  logger.error(`Unhandled Rejection at: ${reason.stack || reason}`)
});
process.on('exit', (code) => {
  console.log(`Exited with code ${code}`);
  logger.info(`Process exit event with code:${code}`);
});