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
* QuantStudio logfile format   
   - We expect the barcode to follow the string "# Barcode: "    
   - We expect 2 additional lines between the comments and headers     
   - For Ct values, we expect the log to have the headers    
       - `Well Position`    
       - `Cq`    
   - For Call values, we expect the log to have the headers
       - `Well Position`    
       - `Call`    
       - It must **NOT** contain the header `Cq`    
* Existing eLabs SampleType and custom fields should not be altered
   - Expected fields are defined in `constants.js`

