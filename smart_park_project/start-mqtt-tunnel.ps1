Write-Host "Avvio ngrok tunnel MQTT sulla porta 1883..." -ForegroundColor Cyan

$ngrokPath = "C:\Users\samu2\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
Start-Process -FilePath $ngrokPath -ArgumentList "tcp 1883" -WindowStyle Minimized

Start-Sleep -Seconds 3

try {
    $tunnels = Invoke-RestMethod http://localhost:4040/api/tunnels
    $url = $tunnels.tunnels[0].public_url
    $parts = ($url -replace "tcp://", "") -split ":"
    $host_part = $parts[0]
    $port_part = $parts[1]

    Write-Host ""
    Write-Host "Tunnel attivo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "-----------------------------------" -ForegroundColor Yellow
    Write-Host "  Host : $host_part" -ForegroundColor White
    Write-Host "  Porta: $port_part" -ForegroundColor White
    Write-Host "  URL  : $url" -ForegroundColor White
    Write-Host "-----------------------------------" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Condividi con i gruppi:" -ForegroundColor Cyan
    Write-Host "   Broker: $host_part" -ForegroundColor Gray
    Write-Host "   Porta : $port_part" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Dashboard ngrok: http://localhost:4040" -ForegroundColor DarkCyan
} catch {
    Write-Host "Errore: ngrok non ancora pronto. Apri http://localhost:4040 manualmente." -ForegroundColor Red
}
