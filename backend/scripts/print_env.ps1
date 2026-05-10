if ($env:BRANCH_ID) { Write-Output "BRANCH_ID=$env:BRANCH_ID" } else { Write-Output "BRANCH_ID=<not set>" }
if ($env:MANAGER_TOKEN) { Write-Output "MANAGER_TOKEN=<set> (length=$($env:MANAGER_TOKEN.Length))" } else { Write-Output "MANAGER_TOKEN=<not set>" }
