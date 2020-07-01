const { v4: uuidv4 } = require("uuid");
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
const constants = require("../constants.js");

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
      return null;
    });
}

async function makeBatchSamples(){

  await login();

  let plateRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  let plateCols = Array.from(Array(12), (_, i) => i + 1);
  let plate_coordinates_96 = [];
  for (let i = 0; i < plateRows.length; i++) {
    for (let j = 0; j < plateCols.length; j++) {
      plate_coordinates_96.push(`${plateRows[i]}${plateCols[j]}`);
    }
  }

  for (let i = 0; i < plate_coordinates_96.length; i++) {
    let sampleId = await makeSample();
    if (sampleId){
      updateMeta(sampleId, constants.META.SAMPLE_BC.KEY,
        `sample-barcode-plate11-${plate_coordinates_96[i]}`,
        constants.META.SAMPLE_BC.TYPE);
    } else {
      console.log("No Sample ID")
    }
  }
}

async function makeSample(name){
  if(!name){
    name = uuidv4();
  }
  return axios
    .post(constants.ENDPOINTS.CREATE_SAMPLE, {
      sampleTypeID: 33369,
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
      logger.error(error);
    });
}

async function parse_logfile(logfile){

  let auth = await login();
  if (!auth || auth !== 200){
    logger.error(`Failed to log into eLabs.`);
    return;
  }

  fs.createReadStream(logfile)
    .pipe(csv.parse({ headers: true }))
    .on('error', (error) => {
      logger.error(error);
      process.exitCode = 8;
    })
    .on('data', (row) => {
      let sampleBC = row[constants.HAMILTON_LOG_HEADERS.SAMPLE_TUBE_BC];
      makeSample(sampleBC);
    })
    .on('end', (rowCount) => logger.info(`Parsed ${rowCount} records`));
}

parse_logfile(argv.file);