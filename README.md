This repository contains code for 

* CSV parsers for the Hamilton logs and qPCR results from the QuantStudio7 Design and Analysis software (`server.js`)
* API calls to eLabs (`server.js`)
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
* Hamilton logfile format   
   - We expect 2 empty lines at the start of the file    
   - Expected headers:     
      - `Protocol`       
      - `Sample Tube Barcode`    
      - `Output Barcode`    
      - `Output Well Number `
      - `UserName`    
      - `Reagent Names`    
      - `Reagent Lot Numbers`   
* QuantStudio logfile format   
   - We expect the barcode to follow the string "# Barcode: "    
   - We expect the technician's initials to follow the string "# User Name:"
   - We expect 2 additional lines between the comments and headers     
   - For Ct values, we expect the log to have the headers    
       - `Well Position`  
       - `Sample`     
       - `Target` 
       - `Cq`    
   - For Call values, we expect the log to have the headers
       - `Well Position`    
       - `Sample`     
       - `Call`    
       - It must **NOT** contain the header `Cq`    
* Existing eLabs SampleType and custom fields should not be altered
   - Expected fields are defined in `constants.js`
   

### Control Fail Procedure
Control samples in every 384 qPCR plate are expected to have the same layout.

```
     1    |    2
A PCR_Pos |  /
-------------------
B    /    |  /
-------------------
C  NTC_1  |  NTC_2
-------------------
D  NTC_3  |  NTC_4
-------------------
E  NEC_1  |  NEC_2
-------------------
F  NEC_3  |  NEC_4
```
* Control sample failures will show WARNING in the qPCR log
    - If PCR Positive Control fails, all 4 96 well plates need to be re-prepped for qPCR. 
    - IF NEC or NTC fails, all samples from the failed *plate(s)* need to have RNA re-extracted. 
* Re-extraction takes precedence. 
    - For example, if PCR_POS and NTC_1 both fail, Plate 1 needs to be re-extracted, and the other 3 
    plates re-prepped. 
    
**Any samples that fail twice in this process are considered invalid and need to be recollected.
Status is to be considered qPCR complete.**

### qPCR Plate Layout

![qPCR_plate](https://user-images.githubusercontent.com/7750862/87336835-7b7a9080-c510-11ea-9b4e-a54849ea1426.png)

Key: Plate 1 (Red), Plate 2 (Green), Plate 3 (Yellow), Plate 4 (Blue)