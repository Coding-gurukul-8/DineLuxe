$base="http://localhost:5001/api/v1"
$branch = $env:BRANCH_ID
try {
  $resp = Invoke-RestMethod -Method Get -Uri "$base/queue/branch/$branch" -Headers @{ Authorization = "Bearer $env:MANAGER_TOKEN" }
  $resp.data | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 tmp_queue.json
  Get-Content tmp_queue.json
} catch {
  Write-Host 'GET queue failed'
  if ($_.Exception.Response) {
    $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host $r.ReadToEnd()
    $r.Dispose()
  } else {
    Write-Host $_.Exception.Message
  }
}
