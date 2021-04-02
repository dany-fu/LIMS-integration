# Author: Christopher Knight
# Last Edit: 7/16/2020

$ShareRoot = "\\nas-ru1.bu.edu\lims\prod\"
$Logfile = $shareroot + "logs\ErrorMonitorLog_$(get-date -f yyyy-MM-dd).log"
$ErrorFolder = $shareroot + "Errors\"
$MailRecipients = "rkc-ctl-servernotifications@bu.edu"


Start-Transcript $Logfile -Force -Append

#Checkthe status of the File Monitor Scheduled Task/Script
$TaskState = Get-ScheduledTask | Where TaskName -eq "Run File Monitor" | Select State | foreach {$_.State}

if (!(($TaskState -eq "Ready") -or ($TaskState -eq "Running"))) {
    Send-MailMessage -From elabsync@bu.edu -To $MailRecipients -SmtpServer smtp.bu.edu -Subject "Error_Monitor Task Status" -Body "The Scheduled Task: Run File Monitor is currently $TaskState."

    #adds this line to the transcript
    Write-Host "Folder Monitor Task Status: $TaskState, Email Notification Sent"
}

#check for items in the Errors Folder
$ErrorCount = Get-ChildItem $ErrorFolder | Measure-Object

if ($ErrorCount.count -gt 0) {
    Send-MailMessage -From elabsync@bu.edu -To $MailRecipients -SmtpServer smtp.bu.edu -Subject "Error Files Detected" -Body "There are $($ErrorCount.count) files in the Errors Folder. Please address these ASAP."

    #adds this line to transcript
    Write-Host "Error Files Detected: $($ErrorCount.count), Email Notification Sent"
}

Stop-Transcript
