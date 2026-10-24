[CmdletBinding()]
param(
  [string]$SubscriptionId,
  [string]$ResourceGroupName = 'rg-eventos-fisi',
  [string]$Location = 'eastus2',
  [ValidatePattern('^[a-z][a-z0-9-]{2,24}$')][string]$NamePrefix = 'eventosfisi',
  [switch]$PrepareOnly,
  [switch]$UpdateOnly
)

$ErrorActionPreference = 'Stop'
$taskBackend = Split-Path -Parent $PSScriptRoot
$taskAzCommand = Get-Command az -ErrorAction SilentlyContinue
$taskAz = if ($taskAzCommand) { $taskAzCommand.Source } else {
  Join-Path $env:ProgramFiles 'Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
}
if (-not (Test-Path -LiteralPath $taskAz)) { throw 'Instala Azure CLI antes de continuar.' }

function Invoke-Azure {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $taskResult = & $taskAz @Arguments
  if ($LASTEXITCODE -ne 0) { throw ('Azure CLI falló: ' + ($Arguments[0..([Math]::Min(2, $Arguments.Length - 1))] -join ' ')) }
  return $taskResult
}

if (-not $PrepareOnly) {
  if (-not $SubscriptionId) { throw 'Indica -SubscriptionId. Para preparar sin crear recursos usa -PrepareOnly.' }
  $taskAccount = (Invoke-Azure account show --subscription $SubscriptionId --output json) | ConvertFrom-Json
  if ($taskAccount.state -ne 'Enabled') {
    throw ('La suscripción está ' + $taskAccount.state + '. No se ha creado ni modificado ningún recurso. Reactiva Azure for Students.')
  }
  Invoke-Azure account set --subscription $SubscriptionId --output none
}

$taskOutput = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
Write-Host 'Validando Bicep y preparando un ZIP solo con el backend...'
Invoke-Azure bicep build --file (Join-Path $PSScriptRoot 'main.bicep') --outfile (Join-Path $taskOutput 'main.json')
$taskZip = Join-Path $taskOutput 'backend.zip'
$taskSource = @('src', 'public', 'package.json', 'package-lock.json') | ForEach-Object { Join-Path $taskBackend $_ }
Compress-Archive -LiteralPath $taskSource -DestinationPath $taskZip -Force
if ($PrepareOnly) { Write-Host ('Preparado: ' + $taskZip + '. No se crearon recursos de Azure.'); return }

$taskSha = [Security.Cryptography.SHA256]::Create()
try { $taskSuffix = ([BitConverter]::ToString($taskSha.ComputeHash([Text.Encoding]::UTF8.GetBytes($SubscriptionId + $NamePrefix)))).Replace('-', '').Substring(0, 8).ToLowerInvariant() }
finally { $taskSha.Dispose() }
$taskAppName = "$NamePrefix-api-$taskSuffix"
$taskPostgresName = "$NamePrefix-pg-$taskSuffix"

if (-not $UpdateOnly) {
  Write-Host 'Configuración: App Service F1; PostgreSQL B1ms, 32 GB, sin alta disponibilidad ni crecimiento automático.'
  Write-Host 'La gratuidad de PostgreSQL depende de los beneficios vigentes de la suscripción.'
  Invoke-Azure group create --name $ResourceGroupName --location $Location --tags project=EventosFISI --output none
  foreach ($taskProvider in @('Microsoft.Web', 'Microsoft.DBforPostgreSQL')) {
    Invoke-Azure provider register --namespace $taskProvider --wait --output none
  }
  $taskExisting = Invoke-Azure resource list --resource-group $ResourceGroupName --resource-type Microsoft.Web/sites --query '[].name' --output tsv
  if (@($taskExisting) -contains $taskAppName) {
    throw 'La aplicación ya existe. Usa -UpdateOnly para actualizar el código sin cambiar credenciales o infraestructura.'
  }
  $taskRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
  $taskBytes = New-Object byte[] 32
  try { $taskRandom.GetBytes($taskBytes) } finally { $taskRandom.Dispose() }
  $taskPassword = 'Aa1!' + [Convert]::ToBase64String($taskBytes).Replace('+', '-').Replace('/', '_')
  $taskParameters = @{
    location = @{ value = $Location }
    appName = @{ value = $taskAppName }
    postgresServerName = @{ value = $taskPostgresName }
    postgresPassword = @{ value = $taskPassword }
  }
  $taskParametersFile = Join-Path ([IO.Path]::GetTempPath()) ('eventos-azure-' + [Guid]::NewGuid().ToString('N') + '.parameters.json')
  try {
    @{ parameters = $taskParameters } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $taskParametersFile -Encoding utf8
    $taskPassword = $null
    Invoke-Azure deployment group validate --resource-group $ResourceGroupName --template-file (Join-Path $PSScriptRoot 'main.bicep') --parameters ('@' + $taskParametersFile) --output none
    Invoke-Azure deployment group create --resource-group $ResourceGroupName --name eventos-fisi --template-file (Join-Path $PSScriptRoot 'main.bicep') --parameters ('@' + $taskParametersFile) --query properties.outputs --output json
  } finally {
    if (Test-Path -LiteralPath $taskParametersFile) { Remove-Item -LiteralPath $taskParametersFile }
    $taskParameters = $null
  }
}

Write-Host 'Publicando únicamente el ZIP de Backend; las dependencias se instalan en Linux...'
Invoke-Azure webapp deploy --resource-group $ResourceGroupName --name $taskAppName --src-path $taskZip --type zip --output none
$taskHost = Invoke-Azure webapp show --resource-group $ResourceGroupName --name $taskAppName --query defaultHostName --output tsv
$taskUrl = 'https://' + $taskHost
Write-Host ('Comprobando API y conexión PostgreSQL en ' + $taskUrl)
& node (Join-Path $taskBackend 'scripts/smoke-remote.js') $taskUrl
if ($LASTEXITCODE -ne 0) { throw 'El despliegue no superó la comprobación remota.' }
Write-Host ('Laboratorio: ' + $taskUrl + '/laboratorio.html')
