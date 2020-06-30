const PATIENT_SAMPLE_ID = 33369;

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
  RESULT: {KEY: "COVID-19 Test Result", TYPE: "COMBO"},
  CT_N1: {KEY: "CT Value (N1)", TYPE: "TEXT"},
  CT_N2: {KEY: "CT Value (N2)", TYPE: "TEXT"},
  CT_RP: {KEY: "CT Value (RP)", TYPE: "TEXT"}
};

const STATUS_VAL = {
  SAMPLE_PREP_DONE: "Sample Transferred To 96-Well Plate",
  RNA_DONE: "RNA Extracted",
  QPCR_PREP_DONE: "qPCR Reactions Prepared",
  QPCR_DONE: "qPCR Run"
};

const TEST_RESULT ={
  POSITIVE: "Positive",
  NEGATIVE: "Negative",
  RETEST: "Retest Required (in lab only)"
};

const ORIGIN_VAL = {
  SAMPLE_PREP: "SAMPLE_PREP",
  RNA_EXTRACTION: "RNA_EXTRACTION",
  QPCR_PREP: "QPCR_PREP"
};

const HAMILTON_LOG_HEADERS = {
  INDEX: "Index",
  PROTOCOL: "Protocol",
  SAMPLE_TUBE_BC: "Sample Tube Barcode",
  DEST_BC: "Output Barcode",
  DEST_WELL_NUM: "Output Well Number"
};

const QPCR_LOG_HEADERS = {
  CALL: "Call",
  CQ: "Cq",
  WELL: "Well",
  TARGET: "Target"
};

module.exports = {
  HAMILTON_LOG_HEADERS: HAMILTON_LOG_HEADERS,
  QPCR_LOG_HEADERS: QPCR_LOG_HEADERS,
  ENDPOINTS: ENDPOINTS,
  META: META,
  STATUS_VAL: STATUS_VAL,
  TEST_RESULT: TEST_RESULT,
  ORIGIN_VAL: ORIGIN_VAL
};
