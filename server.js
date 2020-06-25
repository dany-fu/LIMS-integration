const { v4: uuidv4 } = require("uuid");
const axios = require("axios").default;
const csv = require("fast-csv");
const fs = require("fs");
const argv = require("minimist")(process.argv.slice(2));
const constants = require("./constants.js");


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function equalsIgnoringCase(text, other) {
  return text.localeCompare(other, undefined, { sensitivity: 'accent' }) === 0;
}

async function login(username, password) {
  username = "danyfu@bu.edu";
  password = "foobar";

  return axios
    .post(constants.ENDPOINTS.LOGIN, {
      username: username,
      password: password,
    })
    .then((res) => {
      console.log(`Authentication status code: ${res.status}`);
      if(res.status === 200){
        axios.defaults.headers.common['Authorization'] = res.data.token;
      }
      return res.status;
    })
    .catch((error) => {
      console.error(error);
      return null;
    });
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
        console.log(`Make sample statusCode: ${res.status}`);
        if (res.status === 200){
          console.log(`New sample ID: ${res.data}`);
          return res.data;
        }
      })
      .catch((error) => {
        console.error(error);
      });
}

async function updateMeta(sampleId, key, value, type){
  return axios
    .put(`https://us.elabjournal.com/api/v1/samples/${sampleId}/meta`, {
      key: key,
      value: value,
      sampleDataType: type,
    })
    .then((res) => {
      console.log(`Update sample: ${sampleId}, field:${key}, statusCode: ${res.status}`);
      console.log(res.data);
    })
    .catch((error) => {
      console.error(error);
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

/**
 * Return all Patient Samples and their meta fields that matches a search term
 * @param searchTerm
 * @returns {Promise<void>}
 */
async function getAllPatientSamples(searchTerm){
  await login();

  return axios.get(`${constants.ENDPOINTS.GET_ALL_PATIENT_SAMPLES}&search=${searchTerm}`)
    .then((res) => {
      console.log(`statusCode: ${res.status}`);
      return res.data;
    })
    .catch((error) => {
      console.error(error);
    });
}

/**
 * Find a sample with the given barcode (which is also its name)
 * @param barcode
 * @returns {Promise<void>} Sample object if found, else Null
 */
async function findSample(barcode){
  return axios.get(`${constants.ENDPOINTS.GET_PATIENT_SAMPLE}&name=${barcode}`)
    .then((res) => {
      console.log(`statusCode: ${res.status}`);
      return res.data;
    })
    .catch((error) => {
      console.error(error);
      return null;
    });
}

/**
 * Update PatientSample with the plate barcode and well number
 * from the Sample Prep Hamilton and update status
 * @param sampleBC
 * @param destBC
 * @param destWellNum
 * @returns {Promise<void>}
 */
async function samplePrepTracking(sampleBC, destBC, destWellNum){
  console.log("sample prep");
}

/**
 * Updates PatientSample with the plate barcode and well number
 * from the RNA Extraction Hamilton and update status
 * @param csvRow
 * @returns {Promise<void>}
 */
async function rnaExtractionTracking(csvRow){
  console.log("RNA extraction");

}

/**
 * Updates PatientSample with the plate barcode and well number
 * from the qPCR Prep Hamilton and update status
 * @param sampleBC
 * @param destBC
 * @param destWellNum
 * @returns {Promise<void>}
 */
async function qPCRPrepTracking(sampleBC, destBC, destWellNum){
  console.log("qPCR prep");
}

/**
 * Updates PatientSample with CT values and final result
 * from the QuantStudio and update status
 * @param ct1
 * @param ct2
 * @param ct3
 * @param result
 * @returns {Promise<void>}
 */
async function qPCRRunTracking(ct1, ct2, ct3, result){
  console.log("qPCR Run");
}

/**
 * Calls the appropriate update function based on origin
 * @param csvRow row in the CSV
 * @param origin the process where the logfile originated from
 */
function lineageTracking(csvRow){
  let protocol = csvRow[constants.PROTOCOL].toUpperCase();
  if (!protocol || (!(protocol in constants.ORIGIN_VAL))){
    console.log(`${protocol} is not recognized as a supported process. Must be one of the four values: 
              ${Object.keys(constants.ORIGIN_VAL)}. Index ${csvRow[constants.PROTOCOL]} not processed.`);
    return;
  }

  if(equalsIgnoringCase(protocol, constants.ORIGIN_VAL.QPCR_RUN)){
    let ct1;
    let ct2;
    let ct3;
    let result;
    qPCRRunTracking(ct1, ct2, ct3, result);

  } else {
    let sampleBC = csvRow["Sample Tube Barcode"];
    let destBC = csvRow["Output Barcode"];
    let destWellNum = csvRow["Output Well Number"];

    switch(protocol){
      case constants.ORIGIN_VAL.SAMPLE_PREP:
        samplePrepTracking(sampleBC, destBC, destWellNum);
        break;
      case constants.ORIGIN_VAL.RNA_EXTRACTION:
        rnaExtractionTracking(sampleBC, destBC, destWellNum);
        break;
      case constants.ORIGIN_VAL.QPCR_PREP:
        qPCRPrepTracking(sampleBC, destBC, destWellNum);
        break;
    }
  }
}

async function parse_logfile(logfile){
  // console.log(logfile);
  // console.log(origin);

  let auth = await login();
  if (!auth || auth !== 200){
    console.log(`Failed to log into eLabs.`);
    return;
  }

  fs.createReadStream(logfile)
    .pipe(csv.parse({ headers: true }))
    .on('error', error => console.error(error))
    .on('data', (row) => {
      lineageTracking(row);
    })
    .on('end', (rowCount) => console.log(`Parsed ${rowCount} records`));
}

/**
 * file: path of the CSV file to be parsed
 */
parse_logfile(argv.file);


