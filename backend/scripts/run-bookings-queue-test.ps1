param(
  [string]$Base = $env:BASE,
  [switch]$Auto
)

$ErrorActionPreference = 'Stop'
if (-not $Base) {
  $Base = 'http://localhost:5001/api/v1'
}

function Assert-Env([string[]]$Names) {
  foreach ($name in $Names) {
    if (-not (Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue)) {
      throw "Missing required environment variable: $name"
    }
  }
}

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Action
  )

  Write-Host "`n--- $Title ---" -ForegroundColor Cyan
  $result = & $Action
  if ($null -ne $result) {
    $result | ConvertTo-Json -Depth 10
  }

  if (-not $Auto) {
    Read-Host 'Press Enter to continue'
  }

  return $result
}

function Get-ResponseText {
  param($Response)

  if ($null -eq $Response) {
    return ''
  }

  if ($Response -is [string]) {
    return $Response
  }

  if ($Response.PSObject.Properties.Name -contains 'Content') {
    return [string]$Response.Content
  }

  return [string]$Response
}

function ConvertFrom-ResponseBody {
  param([string]$Body)

  if ([string]::IsNullOrWhiteSpace($Body)) {
    return $null
  }

  try {
    return $Body | ConvertFrom-Json -Depth 10
  }
  catch {
    return $Body
  }
}

function Invoke-ApiRaw {
  param(
    [ValidateSet('GET','POST','PATCH','DELETE')]
    [string]$Method,
    [string]$Path,
    [string]$Token,
    [object]$Body,
    [int]$ExpectedStatus = 200
  )

  $headers = @{}
  if ($Token) {
    $headers.Authorization = "Bearer $Token"
  }

  $uri = "$Base$Path"
  $params = @{
    Method      = $Method
    Uri         = $uri
    Headers     = $headers
    ContentType  = 'application/json'
    ErrorAction  = 'Stop'
  }

  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  try {
    $response = Invoke-WebRequest -UseBasicParsing @params
    $statusCode = [int]$response.StatusCode
    $bodyText = Get-ResponseText $response
  }
  catch {
    $exception = $_.Exception
    $response = $exception.Response

    if ($null -eq $response) {
      throw
    }

    $statusCode = [int]$response.StatusCode
    $stream = $response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $bodyText = $reader.ReadToEnd()
    $reader.Dispose()
  }

  if ($statusCode -ne $ExpectedStatus) {
    throw "Unexpected status code for $Method $uri. Expected $ExpectedStatus, got $statusCode. Body: $bodyText"
  }

  [pscustomobject]@{
    StatusCode = $statusCode
    BodyText   = $bodyText
    Body       = ConvertFrom-ResponseBody $bodyText
  }
}

function Invoke-Api {
  param(
    [ValidateSet('GET','POST','PATCH','DELETE')]
    [string]$Method,
    [string]$Path,
    [string]$Token,
    [object]$Body,
    [int]$ExpectedStatus = 200
  )

  $response = Invoke-ApiRaw -Method $Method -Path $Path -Token $Token -Body $Body -ExpectedStatus $ExpectedStatus

  if ($null -ne $response.Body -and $response.Body.PSObject.Properties.Name -contains 'data') {
    return $response.Body.data
  }

  if ($null -ne $response.Body -and $response.Body.PSObject.Properties.Name -contains 'booking') {
    return $response.Body.booking
  }

  if ($null -ne $response.Body -and $response.Body.PSObject.Properties.Name -contains 'queue') {
    return $response.Body.queue
  }

  if ($null -ne $response.Body -and $response.Body.PSObject.Properties.Name -contains 'result') {
    return $response.Body.result
  }

  return $response.Body
}

function Get-EntityId {
  param([object]$Response)

  $candidates = @()
  if ($null -ne $Response) {
    $candidates += $Response
    if ($Response.PSObject.Properties.Name -contains 'Body') {
      $candidates += $Response.Body
      if ($null -ne $Response.Body -and $Response.Body.PSObject.Properties.Name -contains 'data') {
        $candidates += $Response.Body.data
      }
      if ($null -ne $Response.Body -and $Response.Body.PSObject.Properties.Name -contains 'booking') {
        $candidates += $Response.Body.booking
      }
      if ($null -ne $Response.Body -and $Response.Body.PSObject.Properties.Name -contains 'queue') {
        $candidates += $Response.Body.queue
      }
      if ($null -ne $Response.Body -and $Response.Body.PSObject.Properties.Name -contains 'result') {
        $candidates += $Response.Body.result
      }
      if ($null -ne $Response.BodyText) {
        $match = [regex]::Match([string]$Response.BodyText, '"id"\s*:\s*"([^"]+)"')
        if ($match.Success) {
          return $match.Groups[1].Value
        }
      }
    }
  }

  foreach ($candidate in $candidates) {
    if ($null -ne $candidate -and $candidate.PSObject.Properties.Name -contains 'id' -and $candidate.id) {
      return $candidate.id
    }

    if ($candidate -is [string]) {
      $match = [regex]::Match($candidate, '"id"\s*:\s*"([^"]+)"')
      if ($match.Success) {
        return $match.Groups[1].Value
      }
    }
  }

  throw 'Could not determine id from response.'
}

function Show-ResponseId {
  param([object]$Response, [string]$Name)
  $id = Get-EntityId -Response $Response
  Set-Variable -Name $Name -Value $id -Scope Script
  Write-Host "$Name = $id" -ForegroundColor Green
}

Assert-Env @('CUSTOMER_TOKEN','HOST_TOKEN','MANAGER_TOKEN','WAITER_TOKEN','BRANCH_ID','TABLE_1_ID','TABLE_2_ID')

Write-Host "Using Base: $Base" -ForegroundColor Yellow

$booking1 = Invoke-Step 'STEP 1 - Customer creates a booking' {
  Invoke-Api -Method POST -Path '/bookings' -Token $env:CUSTOMER_TOKEN -Body @{
    branch_id = $env:BRANCH_ID
    arrival_time = '2026-05-15T19:30:00+05:30'
    people_count = 4
    special_requests = 'Window seat preferred, one high chair needed'
  } -ExpectedStatus 201
}
Show-ResponseId -Response $booking1 -Name 'BOOKING_ID'

$booking2 = Invoke-Step 'STEP 2 - Customer creates another booking' {
  Invoke-Api -Method POST -Path '/bookings' -Token $env:CUSTOMER_TOKEN -Body @{
    branch_id = $env:BRANCH_ID
    arrival_time = '2026-05-20T20:00:00+05:30'
    people_count = 2
    special_requests = 'Anniversary dinner'
  } -ExpectedStatus 201
}
Show-ResponseId -Response $booking2 -Name 'BOOKING_ID_2'

Invoke-Step 'STEP 3 - Get my bookings' {
  Invoke-Api -Method GET -Path '/bookings/user/me' -Token $env:CUSTOMER_TOKEN
} | Out-Null

Invoke-Step 'STEP 4 - Get booking by id' {
  Invoke-Api -Method GET -Path "/bookings/$BOOKING_ID" -Token $env:CUSTOMER_TOKEN
} | Out-Null

Invoke-Step 'STEP 5 - Get branch bookings' {
  Invoke-Api -Method GET -Path "/bookings/branch/$($env:BRANCH_ID)?date=2026-05-15" -Token $env:HOST_TOKEN
} | Out-Null

Invoke-Step 'STEP 6 - Customer marks arrived' {
  Invoke-Api -Method PATCH -Path "/bookings/$BOOKING_ID/arrived" -Token $env:CUSTOMER_TOKEN
} | Out-Null

Invoke-Step 'STEP 7 - Host seats the guest' {
  Invoke-Api -Method PATCH -Path "/bookings/$BOOKING_ID/seat" -Token $env:HOST_TOKEN -Body @{ table_id = $env:TABLE_1_ID }
} | Out-Null

Invoke-Step 'STEP 8 - Customer cancels second booking' {
  Invoke-Api -Method PATCH -Path "/bookings/$BOOKING_ID_2/cancel" -Token $env:CUSTOMER_TOKEN -Body @{ reason = 'Change of plans' }
} | Out-Null

$booking3 = Invoke-Step 'STEP 9 - Create booking for manager cancel' {
  Invoke-Api -Method POST -Path '/bookings' -Token $env:CUSTOMER_TOKEN -Body @{
    branch_id = $env:BRANCH_ID
    arrival_time = '2026-05-22T13:00:00+05:30'
    people_count = 6
  } -ExpectedStatus 201
}
Show-ResponseId -Response $booking3 -Name 'BOOKING_ID_3'

Invoke-Step 'STEP 9b - Manager cancels booking' {
  Invoke-Api -Method PATCH -Path "/bookings/$BOOKING_ID_3/cancel" -Token $env:MANAGER_TOKEN -Body @{ reason = 'Branch closed for private event' }
} | Out-Null

$bookingNoShow = Invoke-Step 'STEP 10 - Create booking for no-show test' {
  Invoke-Api -Method POST -Path '/bookings' -Token $env:CUSTOMER_TOKEN -Body @{
    branch_id = $env:BRANCH_ID
    arrival_time = '2026-05-10T18:00:00+05:30'
    people_count = 3
  } -ExpectedStatus 201
}
Show-ResponseId -Response $bookingNoShow -Name 'BOOKING_NOSHOW'

Invoke-Step 'STEP 10b - Host marks booking no-show' {
  Invoke-Api -Method PATCH -Path "/bookings/$BOOKING_NOSHOW/no-show" -Token $env:HOST_TOKEN
} | Out-Null

$queue1 = Invoke-Step 'STEP 11 - Walk-in joins queue' {
  Invoke-Api -Method POST -Path '/queue/join' -Body @{
    branch_id = $env:BRANCH_ID
    people_count = 3
    name = 'Raj Kapoor'
    phone = '+919876540001'
  } -ExpectedStatus 201
}
Show-ResponseId -Response $queue1 -Name 'QUEUE_ID_1'

$queue2 = Invoke-Step 'STEP 12 - Another walk-in joins queue' {
  Invoke-Api -Method POST -Path '/queue/join' -Body @{
    branch_id = $env:BRANCH_ID
    people_count = 2
    name = 'Meena Shah'
    phone = '+919876540002'
  } -ExpectedStatus 201
}
Show-ResponseId -Response $queue2 -Name 'QUEUE_ID_2'

Invoke-Step 'STEP 13 - Get branch queue' {
  Invoke-Api -Method GET -Path "/queue/branch/$($env:BRANCH_ID)" -Token $env:HOST_TOKEN
} | Out-Null

Invoke-Step 'STEP 14 - Check queue position' {
  Invoke-Api -Method GET -Path "/queue/position/$QUEUE_ID_1" -Token $env:HOST_TOKEN
} | Out-Null

Invoke-Step 'STEP 15 - Mark first guest arrived' {
  Invoke-Api -Method PATCH -Path "/queue/$QUEUE_ID_1/arrive" -Token $env:HOST_TOKEN
} | Out-Null

Invoke-Step 'STEP 16 - Assign table to queue guest' {
  Invoke-Api -Method PATCH -Path "/queue/$QUEUE_ID_1/assign-table" -Token $env:HOST_TOKEN -Body @{ table_id = $env:TABLE_1_ID }
} | Out-Null

Invoke-Step 'STEP 17 - Mark second guest no-show' {
  Invoke-Api -Method PATCH -Path "/queue/$QUEUE_ID_2/no-show" -Token $env:HOST_TOKEN
} | Out-Null

$queue3 = Invoke-Step 'STEP 18 - Add third person to queue' {
  Invoke-Api -Method POST -Path '/queue/join' -Body @{
    branch_id = $env:BRANCH_ID
    people_count = 2
    name = 'Amit Roy'
    phone = '+919876540003'
  } -ExpectedStatus 201
}
Show-ResponseId -Response $queue3 -Name 'QUEUE_ID_3'

Invoke-Step 'STEP 18b - Manager removes queue entry' {
  Invoke-Api -Method DELETE -Path "/queue/$QUEUE_ID_3" -Token $env:MANAGER_TOKEN
} | Out-Null

Invoke-Step 'STEP 19 - Geo arrival check' {
  Invoke-Api -Method POST -Path '/geo/arrival-check' -Token $env:CUSTOMER_TOKEN -Body @{
    lat = 19.0760
    lon = 72.8777
    booking_id = $BOOKING_ID
  }
} | Out-Null

Write-Host "`nNegative tests with live assertions:" -ForegroundColor Yellow

Invoke-Step 'NEGATIVE 1 - Booking in the past returns 400' {
  Invoke-Api -Method POST -Path '/bookings' -Token $env:CUSTOMER_TOKEN -Body @{
    branch_id = $env:BRANCH_ID
    arrival_time = '2020-01-01T19:00:00+05:30'
    people_count = 2
  } -ExpectedStatus 400
} | Out-Null

Invoke-Step 'NEGATIVE 2 - Party size 0 returns 400' {
  Invoke-Api -Method POST -Path '/bookings' -Token $env:CUSTOMER_TOKEN -Body @{
    branch_id = $env:BRANCH_ID
    arrival_time = '2026-06-01T19:00:00+05:30'
    people_count = 0
  } -ExpectedStatus 400
} | Out-Null

Invoke-Step 'NEGATIVE 3 - Cancel already-cancelled booking returns 400' {
  Invoke-Api -Method PATCH -Path "/bookings/$BOOKING_ID_2/cancel" -Token $env:CUSTOMER_TOKEN -Body @{ reason = 'Double cancel' } -ExpectedStatus 400
} | Out-Null

Invoke-Step 'NEGATIVE 4 - Queue join with party size 0 returns 400' {
  Invoke-Api -Method POST -Path '/queue/join' -Body @{
    branch_id = $env:BRANCH_ID
    people_count = 0
    name = 'Zero'
    phone = '+919876540099'
  } -ExpectedStatus 400
} | Out-Null

Invoke-Step 'NEGATIVE 5 - Waiter assigning table from queue returns 403' {
  Invoke-Api -Method PATCH -Path "/queue/$QUEUE_ID_1/assign-table" -Token $env:WAITER_TOKEN -Body @{ table_id = $env:TABLE_1_ID } -ExpectedStatus 403
} | Out-Null

Write-Host "`nAll live assertions completed." -ForegroundColor Green
