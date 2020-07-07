const META = {
  DEEPWELL_BC: {KEY: "Sample Deep-Well Barcode", TYPE: "TEXT", META_ID:215483},
  DEEPWELL_WELL_NUM: {KEY: "Sample Deep-Well Well Location", TYPE: "TEXT", META_ID:215495},
  RNA_PLATE_BC: {KEY: "RNA Extraction Plate Barcode", TYPE: "TEXT", META_ID:215498},
  RNA_PLATE_WELL_NUM: {KEY: "RNA Extraction Plate Well Location", TYPE: "TEXT", META_ID:215501},
  QPCR_PLATE_BC: {KEY: "qPCR Plate Barcode", TYPE: "TEXT", META_ID:215504},
  QPCR_PLATE_WELL_NUM: {KEY: "qPCR Plate Well Location", TYPE: "TEXT", META_ID:215507},
  STATUS: {KEY: "Sample Process Status", TYPE: "COMBO", META_ID:213099},
  RESULT: {KEY: "COVID-19 Test Result", TYPE: "COMBO", META_ID:213096},
  CT_N1: {KEY: "CT Value (N1)", TYPE: "TEXT", META_ID:217133},
  CT_N2: {KEY: "CT Value (N2)", TYPE: "TEXT", META_ID:217196},
  CT_RP: {KEY: "CT Value (RP)", TYPE: "TEXT", META_ID:217193},
  NUM_ATTEMPTS: {KEY: "Number of Attempts", TYPE: "COMBO", META_ID:217199},
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
  META: META,
  STATUS_VAL: STATUS_VAL,
  TEST_RESULT: TEST_RESULT,
  ORIGIN_VAL: ORIGIN_VAL
};
