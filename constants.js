const META = {
  DEEPWELL_BC: "Sample Deep-Well Barcode",
  DEEPWELL_WELL_NUM: "Sample Deep-Well Well Location",
  RNA_PLATE_BC: "RNA Extraction Plate Barcode",
  RNA_PLATE_WELL_NUM: "RNA Extraction Plate Well Location",
  QPCR_PLATE_BC: "qPCR Plate Barcode",
  QPCR_PLATE_WELL_NUM: "qPCR Plate Well Location",
  STATUS: "Sample Process Status",
  RESULT: "COVID-19 Test Result",
  CT_N1: "CT Value (N1)",
  CT_N2: "CT Value (N2)",
  CT_RP: "CT Value (RP)",
  NUM_ATTEMPTS: "Number of Attempts",
};

const STATUS_VAL = {
  SAMPLE_PREP_DONE: "Sample Transferred To 96-Well Plate",
  RNA_DONE: "RNA Extracted",
  QPCR_PREP_DONE: "qPCR Reactions Prepared",
  QPCR_DONE: "qPCR Complete",
  RE_EXTRACT: "Re-run RNA Extraction",
  RE_QPCR: "Re-run qPCR"
};

// key is from the "Call" column of the QuantStudio csv
// value is the string that it's mapped to on eLab
const TEST_RESULT ={
  POSITIVE: "Positive",
  NEGATIVE: "Negative",
  INCONCLUSIVE: "Inconclusive - recollect",
  INVALID: "Invalid - recollect",
  WARNING: "Control Failed"
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
