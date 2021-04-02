## Authors: Christopher Knight & Dany Fu
## Last Update: 3/26/2021

$ShareRoot = "\\nas-ru1.bu.edu\lims\test\"
$Logfile = $shareroot + "logs\FileMonitorLog_$(get-date -f yyyy-MM-dd).log"
$GrabPath = $shareroot + "incoming\"
$ArchivePath = $shareroot + "archive\"
$ErrorPath = $shareroot + "errors\"
$AliquotPath = $shareroot + "Aliquot\"
$MailRecipients = "rkc-ctl-servernotifications@bu.edu"

$node = "E:\node-v12.18.2-win-x64\node-v12.18.2-win-x64\node.exe"
$scriptPath = "E:\Scripts\elabsIntegration\server.js"
$scriptLogs = "E:\Scripts\elabsIntegration\logs"
$environment = "stage"

$logparsestart = '**'
$logparseregex = "<error>*</error>"

#use this function to add any additional info the logfile
function Write-Logline ($String){
    "[ $(Get-Date) ]	" + $String | Out-File $Logfile -encoding ASCII -append
}

function Write-Logline-Blank (){"" | Out-File $Logfile -encoding ASCII -append}

#This function will resolve naming conflicts when moving files by appending to the end of the filename
function Safe-Move {
    param (  $Source,
        $Destination)

    $IncrementalNum = 0
    $DestinationPath = $Destination + "\" + $file.Name
    While ((Test-Path $DestinationPath) -eq $True) {
        $IncrementalNum++
        $NewFileName = $file.BaseName + "(" + $IncrementalNum + ")" + $file.Extension
        $DestinationPath = $Destination + "\" + $NewFileName
    }
    Move-Item -Path $file.FullName -Destination $DestinationPath
}

Write-Logline "Starting Script"

####

#Get-ChildItem $GrabPath -Filter "*.csv" -Recurse | Rename-Item -NewName { $_.Name -replace ' ','_' }

##########
########## Remove after test

#Write-Logline "Files Have been renamed to remove spaces. Pausing 30 seconds for test..."
#sleep 30

##########


#this will grab all CSV files in the Incoming Folder and sort them in the order they were last updated (oldest first)
$items = Get-ChildItem $GrabPath -Filter "*.csv" -Recurse | Sort-Object -Property LastWriteTime


ForEach ($file in $items) {
    ## NODE_ENV can be sandbox, development, stage, or production
    ## this value is mapped to the config file in the nodeJS script

    $file_path = $file.FullName

    ####
    #if ($file_path -like '* *'){continue}
    # OR
    #if ($file_path -match ' '){continue}
    ####

    Write-Logline "Processing File: $file_path"
    $params = "$scriptPath --file=""$file_path"" --NODE_ENV=$environment"

    $process = Start-Process -filepath "$node" -argumentlist $params -PassThru -wait


    switch($process.ExitCode) {

        0 { #Successful processing of .csv file by node.js, move .csv to Archive
            Safe-Move -Source $file -Destination $ArchivePath
            Write-Logline "$($process.ExitCode.ToString()) - Moved file: $file_path to Archive"
        }

        14 { #Aliquot File, move .csv to Aliquot
            Safe-Move -Source $file -Destination $AliquotPath
            Write-Logline "$($process.ExitCode.ToString()) - Moved file: $file_path to Aliquot"
        }

        default { #Error parsing or processing file, move .csv to Errors
            Safe-Move -Source $file -Destination $ErrorPath
            Write-Logline "$($process.ExitCode.ToString()) - Moved file: $filepath to Errors"

            $logdata = Get-Content "$scriptlogs\error-$(get-date -Format M-d-yyyy).log"

            #loop to grab all recent lines from error file
            $i = 1
            [string[]]$outputerrors = $null
            while( ! $logdata[$logdata.size - $i].contains($logparsestart) ) {
                $outputerrors += (Select-String -InputObject $logdata[$logdata.size -$i] -Pattern "<error>.*</error>" | foreach {$_.matches}|select value).value.trimstart("<error> ").trimend(" </error>")
                $i ++
            }

            #call one more time to grab the last line
            $outputerrors += (Select-String -InputObject $logdata[$logdata.size -$i] -Pattern "<error>.*</error>" | foreach {$_.matches}|select value).value.trimstart("<error> ").trimend(" </error>")

            #format string for easier read in email
            $formattederrors = $outputerrors -join "`n"

            ## commented out for Test
            #Send-MailMessage -From elabsync@bu.edu -To cknight@bu.edu -SmtpServer smtp.bu.edu -Subject "TST Error Files Detected" -Body "A file was unable to upload to bu-acc.elabjournal.com and is now in the TEST error folder. Please address this ASAP. `n`nErrors:`n$formattederrors"

            Write-Logline "Error Parsing File: $file_path, Moved to Errors"

        }

    }
}


Get-ChildItem $scriptlogs | Copy-Item -Destination ($shareroot + "Logs\NodeJS Logs") -Force


Write-Logline "Ending Script"
Write-Logline-Blank
