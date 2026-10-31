[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SubscriptionId,
  [string]$ResourceGroupName = 'rg-eventos-fisi',
  [string]$ResourceSuffix = 'e4262df5',
  [string]$ImageTag,
  [string]$EgressIp
)
$ErrorActionPreference = 'Stop'
$appName = "eventosfisi-docker-$ResourceSuffix"
if (-not $EgressIp) {
  for ($attempt = 0; $attempt -lt 18; $attempt++) {
    $revisions = (& az containerapp revision list --subscription $SubscriptionId --resource-group $ResourceGroupName --name $appName --output json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron consultar las revisiones del contenedor.' }
    $revision = if ($ImageTag) {
      ($revisions | Where-Object { $_.properties.template.containers[0].image.EndsWith(':' + $ImageTag) } | Select-Object -First 1).name
    } else {
      & az containerapp show --subscription $SubscriptionId --resource-group $ResourceGroupName --name $appName --query properties.latestRevisionName --output tsv
    }
    if ($revision) {
      $result = (& az containerapp exec --subscription $SubscriptionId --resource-group $ResourceGroupName --name $appName --revision $revision --container eventos-api --command 'node /app/src/egress.js' 2>&1) | Out-String
      $match = [regex]::Match($result, 'EGRESS_IP=(\d+(?:\.\d+){3})')
      if ($match.Success) { $EgressIp = $match.Groups[1].Value; break }
    }
    Write-Host 'Esperando la revisión nueva para comprobar su salida de red...'
    Start-Sleep -Seconds 10
  }
}
$address = $null
if (-not [Net.IPAddress]::TryParse($EgressIp, [ref]$address) -or $address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
  throw 'No se obtuvo una IPv4 de salida. Ejecuta src/egress.js en la consola del contenedor y pasa el resultado mediante -EgressIp.'
}
$octets = $address.GetAddressBytes()
if ($octets[0] -eq 0 -or $octets[0] -eq 10 -or $octets[0] -eq 127 -or $octets[0] -ge 224 -or ($octets[0] -eq 172 -and $octets[1] -ge 16 -and $octets[1] -le 31) -or ($octets[0] -eq 192 -and $octets[1] -eq 168) -or ($octets[0] -eq 169 -and $octets[1] -eq 254)) {
  throw 'La regla requiere una IP pública concreta; se rechaza una dirección global de apertura o privada.'
}
& az postgres flexible-server firewall-rule create --subscription $SubscriptionId --resource-group $ResourceGroupName --server-name "eventosfisi-pg-$ResourceSuffix" --name container-app-egress --start-ip-address $EgressIp --end-ip-address $EgressIp --output none
if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar la regla container-app-egress.' }
Write-Host 'Regla container-app-egress configurada para la IP real del contenedor.'
