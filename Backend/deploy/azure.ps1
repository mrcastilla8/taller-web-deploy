[CmdletBinding()]
param(
  [string]$SubscriptionId,
  [string]$ResourceGroupName = 'rg-eventos-fisi',
  [string]$ResourceSuffix = 'e4262df5',
  [string]$Location = 'brazilsouth',
  [string]$ContainerLocation = 'westus',
  [ValidatePattern('^[a-zA-Z0-9_.-]+$')][string]$ImageTag = ('deploy-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')),
  [string]$CredentialSourceAppName,
  [switch]$PrepareOnly,
  [switch]$UpdateOnly
)
$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$repository = Split-Path -Parent $backend
function Invoke-Az {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $result = & az @Arguments
  if ($LASTEXITCODE -ne 0) { throw ('Azure CLI falló: ' + ($Arguments[0..([Math]::Min(2, $Arguments.Length - 1))] -join ' ')) }
  return $result
}
if (-not $PrepareOnly) {
  if (-not $SubscriptionId) { throw 'Indica -SubscriptionId o usa -PrepareOnly.' }
  $account = (Invoke-Az account show --subscription $SubscriptionId --output json) | ConvertFrom-Json
  if ($account.state -ne 'Enabled') { throw 'La suscripción debe estar habilitada.' }
}
$outputDirectory = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
foreach ($template in @('container-foundation', 'container-api')) {
  Invoke-Az bicep build --file (Join-Path $PSScriptRoot ($template + '.bicep')) --outfile (Join-Path $outputDirectory ($template + '.json'))
}
$registry = "eventosfisiacr$ResourceSuffix"
$image = "$registry.azurecr.io/eventos-backend:$ImageTag"
& docker build --tag $image $backend
if ($LASTEXITCODE -ne 0) { throw 'La imagen Docker no se pudo construir.' }
if ($PrepareOnly) {
  Write-Host ('Imagen preparada: ' + $image + '. No se crearon recursos de Azure. El frontend se compila por separado al publicar con la URL real de la API.')
  return
}
if (-not $UpdateOnly) {
  Invoke-Az deployment group create --subscription $SubscriptionId --resource-group $ResourceGroupName --name eventos-contenedores-foundation --template-file (Join-Path $PSScriptRoot 'container-foundation.bicep') --parameters "location=$Location" "containerLocation=$ContainerLocation" "resourceSuffix=$ResourceSuffix" --output none
}
Invoke-Az acr login --subscription $SubscriptionId --name $registry --output none
& docker push $image
if ($LASTEXITCODE -ne 0) { throw 'No se pudo subir la imagen al registro.' }
& (Join-Path $PSScriptRoot 'publish-container.ps1') -SubscriptionId $SubscriptionId -ResourceGroupName $ResourceGroupName -ResourceSuffix $ResourceSuffix -ImageTag $ImageTag -Location $ContainerLocation -CredentialSourceAppName $CredentialSourceAppName
& (Join-Path $PSScriptRoot 'sync-postgres-firewall.ps1') -SubscriptionId $SubscriptionId -ResourceGroupName $ResourceGroupName -ResourceSuffix $ResourceSuffix -ImageTag $ImageTag
$apiName = "eventosfisi-docker-$ResourceSuffix"
$fqdn = Invoke-Az containerapp show --subscription $SubscriptionId --resource-group $ResourceGroupName --name $apiName --query properties.configuration.ingress.fqdn --output tsv
$url = 'https://' + $fqdn
& node (Join-Path $backend 'scripts/smoke-remote.js') $url
if ($LASTEXITCODE -ne 0) { throw 'El backend no superó las comprobaciones con PostgreSQL.' }
& (Join-Path $PSScriptRoot 'publish-frontend.ps1') -SubscriptionId $SubscriptionId -ResourceGroupName $ResourceGroupName -ResourceSuffix $ResourceSuffix
$frontHost = Invoke-Az webapp show --subscription $SubscriptionId --resource-group $ResourceGroupName --name "eventosfisi-web-$ResourceSuffix" --query defaultHostName --output tsv
$frontUrl = 'https://' + $frontHost
& node (Join-Path $backend 'scripts/smoke-web.js') $frontUrl $url
if ($LASTEXITCODE -ne 0) { throw 'La web no superó la comprobación de integración.' }
Write-Host ('Frontend: ' + $frontUrl)
Write-Host ('Backend Docker: ' + $url)
Write-Host ('Salud: ' + $url + '/health')
