This repository contains code for 

* CSV parsers for the Hamilton logs and qPCR results from the QuantStudio7 Design and Analysis software (`server.js`)
* API calls to eLab (`server.js`)
* Example Hamilton logs (`example-hamilton-logs`)
* Example QuantStudio results (`example-qpcr-logs`)

### Installation Requirements
*Because the servers have limited access to the internet, steps 1 & 2 should occur on a separate machine*
1) Download the LTS version of [NodeJS](https://nodejs.org/en/download/)
2) Run `npm install` on the CLI in this directory (where `package.json` is) to download dependencies
3) Copy the entire directory (including `node_modules`) to the server
4) Copy the node executable to the server
5) Configure a link to the executable so that the keyword `node` is recognized
6) Type `node --version` on the CLI to verify
7) Enter in eLabs username and password in the the config files in `/config`    
8) The NODE_ENV variable must be set which matches one of the config file names. For example, `export NODE_ENV=sandbox`

### Processing Requirements 
* Hamilton output format   
   - We expect 2 empty lines at the start of the file    
   - Expected headers:     
      - `Protocol` - must be `SAMPLE_ALIQUOT`, `RNA_EXTRACTION`, or `QPCR_PREP`       
      - `Sample Tube Barcode`    
      - `Output Barcode`    
      - `Output Well Number `
      - `UserName`  
      - `Machine SN`  
      - `Reagent Names` - strings in this file must match exactly the field it maps to on eLabs       
      - `Reagent Lot Numbers` - length of this array must match length of reagent names       
* QuantStudio output format   
   - We expect 2 additional lines between the comments and headers     
   - For Ct values, we expect the Target Call file to have the headers    
       - `Well Position`  
       - `Sample`     
       - `Target` 
       - `Cq`    
   - For Call values, we expect the Well Call file to have the headers
       - `Well Position`    
       - `Sample`     
       - `Call`  - valid values are WARNING, POSITIVE, NEGATIVE, INCONCLUSIVE, or INVALID  
       - It must **NOT** contain the header `Cq`
       - We expect the file to contain the string `[Well Call]`   
       - We expect the serial number to follow the string `# Instrument Serial Number: `   
       - We expect the technician's initials to follow the string `# User Name: `   
   - Only the Well Call file updates the Sample Process Status, qPCR User, and qPCR SN.
   - All samples named `PCR_POS`, `NEC_#`, `NTC_#` is assumed to be a control and skipped during processing 
   UNLESS there is a failure. In which case, the Control Fail Procedure will be followed, outlined below.  
   
* Existing eLab SampleType and custom fields should not be altered    
   - Expected fields are defined in `constants.js`
* **File contents and eLab fields are case and white-space sensitive**
   

### Control Fail Procedure
Control samples in every 384 qPCR plate are expected to have the same layout. Control samples must go onto the plate
according to the following figure and A2, B1, B2 are empty. The rest of plate are patient samples. 

```
     1    |    2
A PCR_POS |  /
-------------------
B    /    |  /
-------------------
C  NTC_1  |  NTC_3
-------------------
D  NTC_2  |  NTC_4
-------------------
E  NEC_1  |  NEC_3
-------------------
F  NEC_2  |  NEC_4
```
* Control sample failures will show WARNING in qPCR results    
    - If PCR Positive Control fails, all 4 96 well plates need to be re-prepped for qPCR.    
    - IF NEC or NTC fails, all samples from the failed *plate(s)* need to have RNA re-extracted.    
    - If WARNING is found outside of these 9 wells, no samples will be processed.     
* See qPCR Plate Layout to match patient samples to control sample.    
* Re-extraction takes precedence. 
    - For example, if PCR_POS and NTC_1 both fail, Plate 1 needs to be re-extracted, and the other 3 
    plates re-prepped. 
    
**Any samples that fail twice in this process are considered invalid and need to be recollected.
Status is to be considered qPCR complete.**

### qPCR Plate Layout

![qPCR_plate](https://user-images.githubusercontent.com/7750862/87336835-7b7a9080-c510-11ea-9b4e-a54849ea1426.png)

Key: Plate 1 (Red), Plate 2 (Green), Plate 3 (Yellow), Plate 4 (Blue)