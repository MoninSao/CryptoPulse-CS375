# CryptoPulse Development Startup Script (Windows)
# Starts both backend and frontend servers concurrently

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Starting CryptoPulse Development     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "server") -or -not (Test-Path "frontend")) {
    Write-Host "❌ Error: server/ or frontend/ directory not found" -ForegroundColor Red
    Write-Host "Please run this script from the CryptoPulse-CS375 root directory"
    exit 1
}

# Start backend server
Write-Host "🚀 Starting backend server..." -ForegroundColor Blue
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\server
    npm run dev
}

# Wait a bit for backend to start
Start-Sleep -Seconds 2

# Start frontend server
Write-Host ""
Write-Host "🚀 Starting frontend server..." -ForegroundColor Blue
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\frontend
    node server.js
}

# Display URLs
Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   CryptoPulse is ready!                ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend:     http://localhost:3000" -ForegroundColor Green
Write-Host "Backend API:  http://localhost:4000/api" -ForegroundColor Green
Write-Host "WebSocket:    ws://localhost:4000/ws/prices" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Open http://localhost:3000 in your browser" -ForegroundColor Blue
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers"
Write-Host ""

# Function to cleanup
function Stop-Servers {
    Write-Host ""
    Write-Host "🛑 Shutting down servers..." -ForegroundColor Blue
    Stop-Job $backendJob, $frontendJob
    Remove-Job $backendJob, $frontendJob
    Write-Host "✅ All servers stopped" -ForegroundColor Green
}

# Wait and show logs
try {
    while ($true) {
        Start-Sleep -Seconds 1
        Receive-Job $backendJob, $frontendJob
    }
}
finally {
    Stop-Servers
}
