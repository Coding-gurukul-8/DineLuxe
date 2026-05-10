$base = "http://localhost:5001/api/v1"

# Unique owner email
$ts = Get-Date -Format yyyyMMddHHmmss
$ownerEmail = "owner.test.$ts@example.com"
$ownerPassword = "Owner@1234"

Write-Output "Owner email: $ownerEmail"

function PostJson($url, $body, $token) {
  $h = @{}
  if ($token) { $h['Authorization'] = "Bearer $token" }
  try {
    return Invoke-RestMethod -Method Post -Uri $url -Body ($body | ConvertTo-Json -Depth 6) -ContentType 'application/json' -Headers $h
  } catch {
    Write-Host "POST $url failed"
    if ($_.Exception.Response) {
      $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $txt = $r.ReadToEnd(); $r.Dispose(); Write-Host $txt; return $null
    } else { Write-Host $_.Exception.Message; return $null }
  }
}

function GetJson($url, $token) {
  $h = @{}
  if ($token) { $h['Authorization'] = "Bearer $token" }
  try { return Invoke-RestMethod -Method Get -Uri $url -Headers $h } catch { Write-Host "GET $url failed"; if ($_.Exception.Response) { $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $txt=$r.ReadToEnd(); $r.Dispose(); Write-Host $txt } else { Write-Host $_.Exception.Message }; return $null }
}

# 1) Register restaurant -> creates owner + branch
$registerBody = @{
  owner = @{
    first_name = 'Auto'
    last_name = 'Owner'
    email = $ownerEmail
    phone = '9876501234'
    dob = '1990-01-01'
    password = $ownerPassword
  }
  restaurant = @{
    name = "Auto Test Restaurant $ts"
    cuisine_types = @('Test')
    description = 'Automated test'
    gst_number = 'TESTGST1234'
    contact_email = $ownerEmail
    contact_phone = '9876501234'
  }
  branch = @{
    name = "Auto Branch"
    address_line1 = '123 Test St'
    city = 'TestCity'
    state = 'TS'
    pincode = '000000'
    phone = '9876501234'
    seating_capacity = 20
  }
}

Write-Output "Registering restaurant..."
$reg = PostJson "$base/restaurants/register" $registerBody $null
if (-not $reg) { Write-Host 'Register failed'; exit 1 }
Write-Output "Register response: $reg | ConvertTo-Json"

$branchId = $reg.branch.id
Write-Output "Branch ID: $branchId"

# 2) Login as owner
Write-Output "Logging in as owner..."
$loginBody = @{ emailOrUsername = $ownerEmail; password = $ownerPassword }
$login = PostJson "$base/auth/login" $loginBody $null
if (-not $login) { Write-Host 'Owner login failed'; exit 1 }
$ownerToken = $login.accessToken
Write-Output "Owner token length: $($ownerToken.Length)"

# 3) Create manager via /staff/create
$managerEmail = "mgr.test.$ts@example.com"
$managerBody = @{
  first_name = 'Auto'
  last_name = 'Manager'
  email = $managerEmail
  phone = '9876512345'
  dob = '1988-05-15' # default password = 15051988
  gender = 'male'
  role = 'manager'
  branch_id = $branchId
}
Write-Output "Creating manager $managerEmail..."
$createMgr = PostJson "$base/staff/create" $managerBody $ownerToken
if (-not $createMgr) { Write-Host 'Create manager failed'; exit 1 }
Write-Output "Manager created: $($createMgr | ConvertTo-Json -Depth 4)"

# 4) Login as manager (default password = DOB DDMMYYYY)
$mgrPassword = '15051988'
$mgrLoginBody = @{ emailOrUsername = $managerEmail; password = $mgrPassword }
Write-Output "Logging in as manager..."
$mgrLogin = PostJson "$base/auth/login" $mgrLoginBody $null
if (-not $mgrLogin) { Write-Host 'Manager login failed'; exit 1 }
$managerToken = $mgrLogin.accessToken
Write-Output "Manager token length: $($managerToken.Length)"

# 5) Provision a free table suitable for capacity >=3
$tableBody = @{ branch_id = $branchId; label = 'T1'; capacity = 4 }
Write-Output "Creating table..."
$createTable = PostJson "$base/tables" $tableBody $managerToken
if (-not $createTable) { Write-Host 'Create table failed'; exit 1 }
$tableId = $createTable.data.id
Write-Output "Created table id: $tableId"

# 6) Join queue (walk-in) — unauthenticated is allowed
$joinBody = @{ branch_id = $branchId; name = 'WalkIn Guest'; people_count = 3 }
Write-Output "Joining queue..."
$joinResp = PostJson "$base/queue/join" $joinBody $null
if (-not $joinResp) { Write-Host 'Join queue failed'; exit 1 }
$queueId = $joinResp.id
Write-Output "Queue id: $queueId"

# 7) Mark arrived as manager
Write-Output "Marking arrived..."
try {
  $arr = Invoke-RestMethod -Method Patch -Uri "$base/queue/$queueId/arrive" -Headers @{ Authorization = "Bearer $managerToken" } -ContentType 'application/json'
  Write-Output "Arrive response: $(($arr | ConvertTo-Json -Depth 4))"
} catch {
  Write-Host 'Arrive failed'; if ($_.Exception.Response) { $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $txt=$r.ReadToEnd(); $r.Dispose(); Write-Host $txt } else { Write-Host $_.Exception.Message }
}

# 8) Attempt assign-table
$assignBody = @{ table_id = $tableId }
Write-Output "Assigning table $tableId to queue $queueId..."
try {
  $assign = Invoke-RestMethod -Method Patch -Uri "$base/queue/$queueId/assign-table" -Headers @{ Authorization = "Bearer $managerToken" } -Body ($assignBody | ConvertTo-Json) -ContentType 'application/json'
  Write-Output "Assign response: $(($assign | ConvertTo-Json -Depth 6))"
} catch {
  Write-Host 'Assign failed'; if ($_.Exception.Response) { $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $txt=$r.ReadToEnd(); $r.Dispose(); Write-Host $txt } else { Write-Host $_.Exception.Message }
}

Write-Output "Script finished."
