[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SubscriptionId,
  [string]$ResourceGroupName = 'rg-eventos-fisi',
  [string]$ResourceSuffix = 'e4262df5',
  [Parameter(Mandatory = $true)][string]$ImageTag,
  [string]$Location = 'westus',
  [string]$CredentialSourceAppName,
  [Security.SecureString]$DatabaseUrl
)
$ErrorActionPreference = 'Stop'
function Invoke-Az {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $result = & az @Arguments
  if ($LASTEXITCODE -ne 0) { throw ('Azure CLI falló: ' + ($Arguments[0..([Math]::Min(2, $Arguments.Length - 1))] -join ' ')) }
  return $result
}
$account = (Invoke-Az account show --subscription $SubscriptionId --output json) | ConvertFrom-Json
if ($account.state -ne 'Enabled') { throw 'La suscripción debe estar habilitada.' }
$frontName = "eventosfisi-web-$ResourceSuffix"
$frontHost = Invoke-Az webapp show --subscription $SubscriptionId --resource-group $ResourceGroupName --name $frontName --query defaultHostName --output tsv
$parameterFile = Join-Path ([IO.Path]::GetTempPath()) ('eventos-container-' + [Guid]::NewGuid().ToString('N') + '.parameters.json')
$plainUrl = $null
try {
  if ($DatabaseUrl) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($DatabaseUrl)
    try { $plainUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  } elseif ($CredentialSourceAppName) {
    $settings = (Invoke-Az webapp config appsettings list --subscription $SubscriptionId --resource-group $ResourceGroupName --name $CredentialSourceAppName --output json) | ConvertFrom-Json
    $plainUrl = ($settings | Where-Object name -eq 'DATABASE_URL').value
    $settings = $null
  } else {
    $appId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.App/containerApps/eventosfisi-docker-$ResourceSuffix"
    $secrets = (Invoke-Az rest --method post --url "https://management.azure.com${appId}/listSecrets?api-version=2024-03-01" --output json) | ConvertFrom-Json
    $plainUrl = ($secrets.value | Where-Object name -eq 'database-url').value
    $secrets = $null
  }
  if (-not $plainUrl) { throw 'Falta una conexión PostgreSQL. Usa -DatabaseUrl o -CredentialSourceAppName en la primera migración.' }
  $parameters = @{ parameters = @{
    location = @{ value = $Location }
    resourceSuffix = @{ value = $ResourceSuffix }
    imageTag = @{ value = $ImageTag }
    frontendOrigin = @{ value = "https://$frontHost" }
    databaseUrl = @{ value = $plainUrl }
  } }
  $parameters | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $parameterFile -Encoding utf8
  Invoke-Az deployment group create --subscription $SubscriptionId --resource-group $ResourceGroupName --name eventos-contenedores-api --template-file (Join-Path $PSScriptRoot 'container-api.bicep') --parameters ('@' + $parameterFile) --no-wait --output none
  Write-Host 'Creación o actualización del backend enviada. Consultar el despliegue eventos-contenedores-api; configurar sus IP de salida en PostgreSQL antes de comprobar /api/ready.'
} finally {
  $plainUrl = $null
  $parameters = $null
  if (Test-Path -LiteralPath $parameterFile) { Remove-Item -LiteralPath $parameterFile }
}
