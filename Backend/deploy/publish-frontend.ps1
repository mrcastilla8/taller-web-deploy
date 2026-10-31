[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SubscriptionId,
  [string]$ResourceGroupName = 'rg-eventos-fisi',
  [string]$ResourceSuffix = 'e4262df5'
)
$ErrorActionPreference = 'Stop'
$frontend = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../Frontend'))
$fqdn = & az containerapp show --subscription $SubscriptionId --resource-group $ResourceGroupName --name "eventosfisi-docker-$ResourceSuffix" --query properties.configuration.ingress.fqdn --output tsv
if ($LASTEXITCODE -ne 0 -or -not $fqdn) { throw 'No se pudo obtener la URL del backend desplegado.' }
$previousBase = $env:VITE_API_BASE_URL
try {
  $env:VITE_API_BASE_URL = 'https://' + $fqdn
  Push-Location $frontend
  try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'La compilación React falló.' } }
  finally { Pop-Location }
} finally { $env:VITE_API_BASE_URL = $previousBase }
$outputDirectory = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$zip = Join-Path $outputDirectory 'frontend.zip'
Compress-Archive -LiteralPath @((Join-Path $frontend 'dist'), (Join-Path $frontend 'server.mjs')) -DestinationPath $zip -Force
& az webapp deploy --subscription $SubscriptionId --resource-group $ResourceGroupName --name "eventosfisi-web-$ResourceSuffix" --src-path $zip --type zip --output none
if ($LASTEXITCODE -ne 0) { throw 'La publicación del frontend falló.' }
Write-Host ('Frontend publicado y conectado a https://' + $fqdn)
