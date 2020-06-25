const PATIENT_SAMPLE_ID = 33369;
const INDEX = "Index";
const PROTOCOL = "Protocol";
const SAMPLE_TUBE_BC = "Sample Tube Barcode";
const DEST_BC = "Output Barcode";
const DEST_WELL_NUM = "Output Well Number";

const ENDPOINTS = {
  LOGIN: "https://us.elabjournal.com/api/v1/auth/user",
  GET_SAMPLE_TYPES: "https://us.elabjournal.com/api/v1/sampleTypes",
  CREATE_SAMPLE: "https://us.elabjournal.com/api/v1/samples?autoCreateMetaDefaults=true",
  GET_ALL_PATIENT_SAMPLES: `https://us.elabjournal.com/api/v1/samples?$expand=meta&sampleTypeID=${PATIENT_SAMPLE_ID}`,
  GET_PATIENT_SAMPLE: `https://us.elabjournal.com/api/v1/samples?sampleTypeID=${PATIENT_SAMPLE_ID}`
};

const META = {
  SAMPLE_BC: {KEY: "Sample Barcode", TYPE: "TEXT"},
  DEEPWELL_BC: {KEY: "Sample Deep-Well Barcode", TYPE: "TEXT"},
  DEEPWELL_WELL_NUM: {KEY: "Sample Deep-Well Well Location", TYPE: "TEXT"},
  RNA_PLATE_BC: {KEY: "RNA Extraction Plate Barcode", TYPE: "TEXT"},
  RNA_PLATE_WELL_NUM: {KEY: "RNA Extraction Plate Well Location", TYPE: "TEXT"},
  QPCR_PLATE_BC: {KEY: "qPCR Plate Barcode", TYPE: "TEXT"},
  QPCR_PLATE_WELL_NUM: {KEY: "qPCR Plate Well Location", TYPE: "TEXT"},
  STATUS: {KEY: "Sample Process Status", TYPE: "COMBO"},
  RESULT: {KEY: "COVID-19 Test Result", TYPE: "COMBO"}
};

const STATUS_VAL = {
  SAMPLE_PREP_DONE: "Sample Transferred To 96-Well Plate",
  RNA_DONE: "RNA Extracted",
  QPCR_PREP_DONE: "qPCR Reactions Prepared",
  QPCR_DONE: "qPCR Run",
  ALL_DONE: "Completed"
};

const ORIGIN_VAL = {
  SAMPLE_PREP: "SAMPLE_PREP",
  RNA_EXTRACTION: "RNA_EXTRACTION",
  QPCR_PREP: "QPCR_PREP",
  QPCR_RUN: "QPCR_RUN"
};

module.exports = {
  INDEX: INDEX,
  PROTOCOL: PROTOCOL,
  SAMPLE_TUBE_BC: SAMPLE_TUBE_BC,
  DEST_BC: DEST_BC,
  DEST_WELL_NUM: DEST_WELL_NUM,
  ENDPOINTS: ENDPOINTS,
  META: META,
  STATUS_VAL: STATUS_VAL,
  ORIGIN_VAL: ORIGIN_VAL
};
