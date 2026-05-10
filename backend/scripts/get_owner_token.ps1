$body = Get-Content "backend\scripts\owner_login.json" -Raw
$r = Invoke-RestMethod -Uri 'http://localhost:5001/api/v1/auth/login' -Method Post -Body $body -ContentType 'application/json'
Write-Output $r.data.accessToken
