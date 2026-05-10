$base = "http://localhost:5001/api/v1"
$ownerEmail = 'owner.test.20260511005916@example.com'
$ownerPassword = 'Owner@1234'
$branchId = 'c250c61c-f53f-430d-9b56-fc083a662bf8'

function PostJson($url, $body, $token) {
  $h = @{}
  if ($token) { $h['Authorization'] = "Bearer $token" }
  try { return Invoke-RestMethod -Method Post -Uri $url -Body ($body | ConvertTo-Json -Depth 6) -ContentType 'application/json' -Headers $h } catch { Write-Host "POST $url failed"; if ($_.Exception.Response) { $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $txt=$r.ReadToEnd(); $r.Dispose(); Write-Host $txt } else { Write-Host $_.Exception.Message }; return $null }
}

function PatchNoBody($url, $token) {
  $h = @{}
  if ($token) { $h['Authorization'] = "Bearer $token" }
  try { return Invoke-RestMethod -Method Patch -Uri $url -ContentType 'application/json' -Headers $h } catch { Write-Host "PATCH $url failed"; if ($_.Exception.Response) { $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $txt=$r.ReadToEnd(); $r.Dispose(); Write-Host $txt } else { Write-Host $_.Exception.Message }; return $null }
}

# Login owner
Write-Output "Logging in as owner..."
$login = PostJson "$base/auth/login" @{ emailOrUsername = $ownerEmail; password = $ownerPassword } $null
if (-not $login) { Write-Host 'Owner login failed'; exit 1 }
$ownerToken = $login.data.accessToken
Write-Output "Owner token length: $($ownerToken.Length)"

# Create manager
$managerEmail = 'mgr.test.20260511005916@example.com'
$managerBody = @{ first_name='Auto'; last_name='Manager'; email=$managerEmail; phone='9876512345'; dob='1988-05-15'; gender='male'; role='manager'; branch_id=$branchId }
Write-Output "Creating manager..."
 $createMgr = PostJson "$base/staff/create" $managerBody $ownerToken
 if (-not $createMgr) { Write-Host 'Create manager failed — continuing with owner token' } else { Write-Output "Create manager response: $($createMgr | ConvertTo-Json -Depth 4)" }

# Login manager only if creation returned data
if ($createMgr) {
  $mgrPassword = '15051988'
  $mgrLogin = PostJson "$base/auth/login" @{ emailOrUsername = $managerEmail; password = $mgrPassword } $null
  if (-not $mgrLogin) { Write-Host 'Manager login failed; continuing with owner token' } else { $managerToken = $mgrLogin.data.accessToken; Write-Output "Manager token length: $($managerToken.Length)" }
} else { Write-Output 'Skipping manager login (manager not created) - using owner token' }

# Create table
$tableBody = @{ branch_id = $branchId; label = 'T1'; capacity = 4 }
$authToken = if ($managerToken) { $managerToken } else { $ownerToken }
$createTable = PostJson "$base/tables" $tableBody $authToken
if (-not $createTable) { Write-Host 'Create table failed'; exit 1 }
$tableId = $createTable.data.id
Write-Output "Table created: $tableId"

# Join queue
$join = PostJson "$base/queue/join" @{ branch_id = $branchId; name = 'WalkIn Guest'; people_count = 3 } $null
if (-not $join) { Write-Host 'Join queue failed'; exit 1 }
$queueId = $join.id
Write-Output "Queue id: $queueId"

# Mark arrived
Write-Output "Marking arrived..."
$arr = Invoke-RestMethod -Method Patch -Uri "$base/queue/$queueId/arrive" -Headers @{ Authorization = "Bearer $authToken" } -ContentType 'application/json'
Write-Output "Arrive response: $($arr | ConvertTo-Json -Depth 4)"

# Assign table
$assignBody = @{ table_id = $tableId }
try {
  $assign = Invoke-RestMethod -Method Patch -Uri "$base/queue/$queueId/assign-table" -Headers @{ Authorization = "Bearer $authToken" } -Body ($assignBody | ConvertTo-Json) -ContentType 'application/json'
  Write-Output "Assign response: $(($assign | ConvertTo-Json -Depth 6))"
} catch {
  Write-Host 'Assign failed'; if ($_.Exception.Response) { $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $txt=$r.ReadToEnd(); $r.Dispose(); Write-Host $txt } else { Write-Host $_.Exception.Message }
}

Write-Output 'Done.'
