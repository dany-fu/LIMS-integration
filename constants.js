// Author: Dany Fu (danyfu@bu.edu)

const META = {
  DEEPWELL_BC: "Extraction Plate Barcode",
  DEEPWELL_WELL_NUM: "Extraction Plate Well Location",
  RNA_PLATE_BC: "RNA Elution Plate Barcode",
  RNA_PLATE_WELL_NUM: "RNA Elution Plate Well Location",
  QPCR_PLATE_BC: "qPCR Plate Barcode",
  QPCR_PLATE_WELL_NUM: "qPCR Plate Well Location",
  STATUS: "Sample Process Status",
  RESULT: "COVID-19 Test Result",
  N1: "CT Value (N1)",
  N2: "CT Value (N2)",
  RP: "CT Value (RP)",
  NUM_ATTEMPTS: "Number of Attempts",
  SAMPLE_PREP_TECH: "Sample Aliquot User",
  EXTRACTION_TECH: "RNA Extraction User",
  QPCR_PREP_TECH: "qPCR Prep User",
  QPCR_TECH: "qPCR User",
  SAMPLE_PREP_SN: "Sample Aliquot Instrument SN",
  EXTRACTION_SN: "RNA Extraction Instrument SN",
  QPCR_PREP_SN: "qPCR Prep Instrument SN",
  QPCR_SN: "qPCR SN",
  PERFORMED: "Performed"
};

const STATUS_VAL = {
  SAMPLE_PREP_DONE: "Sample Transferred to Extraction Plate",
  RNA_DONE: "RNA Extracted",
  QPCR_PREP_DONE: "qPCR Plate Prepared",
  QPCR_DONE: "Finished",
  QPCR_COMPLETE: "qPCR Completed",
  RE_EXTRACT: "Re-run RNA Extraction",
  RE_QPCR: "Re-run qPCR"
};

// key is from the "Call" column of the QuantStudio csv
// value is the string that it's mapped to on eLab
const TEST_RESULT = {
  POSITIVE: "Positive",
  NEGATIVE: "Negative",
  INCONCLUSIVE: "Inconclusive - recollect",
  INVALID: "Invalid - recollect",
  WARNING: "Control Failed"
};

const ORIGIN_VAL = {
  SAMPLE_ALIQUOT: "SAMPLE_ALIQUOT",
  RNA_EXTRACTION: "RNA_EXTRACTION",
  QPCR_PREP: "QPCR_PREP"
};

const HAMILTON_LOG_HEADERS = {
  INDEX: "Index",
  PROTOCOL: "Protocol",
  SAMPLE_TUBE_BC: "Sample Tube Barcode",
  DEST_BC: "Output Barcode",
  DEST_WELL_NUM: "Output Well Number",
  REAGENT_NAMES: "Reagent Names",
  REAGENT_NUMS: "Reagent Lot Numbers",
  USER: "UserName",
  SERIAL_NUM: "Machine SN",
  ELAB_ID: "eLab Sample ID"
};

const QPCR_LOG_HEADERS = {
  WELL: "Well Position",
  SAMPLE: "Sample",
  CALL: "Call",
  TARGET: "Target",
  CQ: "Cq"
};

const CONTROLS = {
  PCR_POS: "PCR_POS",
  NTC: "NTC_",
  NEC: "NEC_"
};

const CONTROL_WELLS = ["A1", "C1", "C2", "D1", "D2", "E1", "E2", "F1", "F2"];

const PLATE384 = {
  ROW: 16,
  COL: 24
};

const MAX_ATTEMPTS = 5;

//constants that are unique to pooled testing
const POOLED = {
  INDIVIDUAL: "Individual",
  POOLED:  "Pooled",
  POSITIVE:  "Presumptive Positive",
};

module.exports = {
  HAMILTON_LOG_HEADERS: HAMILTON_LOG_HEADERS,
  QPCR_LOG_HEADERS: QPCR_LOG_HEADERS,
  META: META,
  STATUS_VAL: STATUS_VAL,
  TEST_RESULT: TEST_RESULT,
  ORIGIN_VAL: ORIGIN_VAL,
  CONTROLS: CONTROLS,
  CONTROL_WELLS: CONTROL_WELLS,
  PLATE384: PLATE384,
  MAX_ATTEMPTS: MAX_ATTEMPTS,
  POOLED: POOLED
};