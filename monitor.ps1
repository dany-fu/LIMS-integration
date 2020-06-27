$paths = Get-Content 'C:\Users\danyfu\Documents\eLabs-integration\monitored_paths_test.txt';
foreach ($folder_path in $paths)  {
  ### SET FOLDER TO WATCH
  $watcher = New-Object System.IO.FileSystemWatcher
  $watcher.Path = $folder_path
  $watcher.Filter = "*.csv" # pick up only CSV
  $watcher.IncludeSubdirectories = $false
  $watcher.EnableRaisingEvents = $true

  ### DEFINE ACTIONS AFTER AN EVENT IS DETECTED
  $action = { $eLabsFolder = 'C:\Users\danyfu\Documents\eLabs-integration\'
              $logTxt = Join-Path $eLabsFolder 'monitor_log.txt' # log every file that is processed
              $scriptPath = Join-Path $eLabsFolder 'server.js' #nodeJS script for updating sample records
              $file_path = $Event.SourceEventArgs.FullPath

              # pass the logfile to script to be parsed
              $params = "--file=$file_path"
              node $scriptPath $params

              # Record the name and date of the file that was added
              $changeType = $Event.SourceEventArgs.ChangeType
              $logline = "$(Get-Date), $changeType, $file_path"
              Add-content $logTxt -value $logline
            }

    ### DECIDE WHICH EVENTS SHOULD BE WATCHED
    Register-ObjectEvent $watcher "Created" -Action $action
}

while ($true) {sleep 5}
