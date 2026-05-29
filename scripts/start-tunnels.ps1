# start-tunnels.ps1
# Windows PowerShell script to start Ngrok and Localtunnel and expose the local backends.

Write-Host "Starting Ngrok for Node.js Backend (Port 4000)..." -ForegroundColor Cyan
Start-Process -FilePath "ngrok" -ArgumentList "http 4000 --log=stdout" -RedirectStandardOutput "$env:TEMP\ngrok_node.log" -WindowStyle Hidden

Write-Host "Starting Localtunnel for Python Backend (Port 4001)..." -ForegroundColor Cyan
Start-Process -FilePath "npx" -ArgumentList "localtunnel --port 4001" -RedirectStandardOutput "$env:TEMP\lt_python.log" -WindowStyle Hidden

Write-Host "Waiting for tunnels to establish..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Extract Ngrok URL
$ngrokUrl = ""
try {
    $ngrokApiResp = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
    $nodeTunnel = $ngrokApiResp.tunnels | Where-Object { $_.config.addr -match "4000" }
    if ($nodeTunnel) {
        $ngrokUrl = $nodeTunnel.public_url
    }
} catch {
    Write-Host "Failed to get Ngrok URL. Is Ngrok installed and authenticated?" -ForegroundColor Red
}

# Extract Localtunnel URL
$ltUrl = ""
try {
    $ltLog = Get-Content "$env:TEMP\lt_python.log" -ErrorAction Stop
    if ($ltLog -match "(https://[^\s]+)") {
        $ltUrl = $matches[1]
    }
} catch {
    Write-Host "Failed to get Localtunnel URL. Is Node.js/npx installed?" -ForegroundColor Red
}

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "Tunnels established! Copy these into Vercel Environment Variables:" -ForegroundColor Green
Write-Host ""
Write-Host "VITE_BACKEND_URL=$ngrokUrl" -ForegroundColor White
Write-Host "VITE_PYTHON_BACKEND_URL=$ltUrl" -ForegroundColor White
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Localtunnel requires bypassing the reminder page."
Write-Host "If you experience issues with the Python backend, visit $ltUrl in your browser first and click 'Click to Continue'." -ForegroundColor Yellow
Write-Host "To stop the tunnels, run: Stop-Process -Name ngrok, node -ErrorAction SilentlyContinue"
