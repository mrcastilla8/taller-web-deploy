@description('Región permitida por la suscripción de Azure for Students.')
param location string

param appName string
param postgresServerName string
param administratorLogin string = 'eventosadmin'

@secure()
param postgresPassword string

var databaseName = 'eventos'
var tags = { project: 'EventosFISI', purpose: 'taller-academico' }

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  tags: tags
  kind: 'linux'
  sku: { name: 'F1', tier: 'Free', capacity: 1 }
  properties: { reserved: true }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresServerName
  location: location
  tags: tags
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: administratorLogin
    administratorLoginPassword: postgresPassword
    authConfig: { activeDirectoryAuth: 'Disabled', passwordAuth: 'Enabled' }
    storage: { storageSizeGB: 32, autoGrow: 'Disabled' }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: databaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'npm start'
      alwaysOn: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'HOST', value: '0.0.0.0' }
        { name: 'DB_SSL', value: 'require' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'ENABLE_ORYX_BUILD', value: 'true' }
        {
          name: 'DATABASE_URL'
          value: 'postgresql://${administratorLogin}:${uriComponent(postgresPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${database.name}'
        }
      ]
    }
  }
}

// Un módulo permite evaluar la lista de IPs una vez creado App Service.
module firewall './firewall.bicep' = {
  name: '${appName}-database-firewall'
  params: {
    postgresServerName: postgres.name
    ipAddresses: union(
      split(app.properties.outboundIpAddresses, ','),
      split(app.properties.possibleOutboundIpAddresses, ',')
    )
  }
}

output appName string = app.name
output postgresServerName string = postgres.name
output backendUrl string = 'https://${app.properties.defaultHostName}'
output laboratoryUrl string = 'https://${app.properties.defaultHostName}/laboratorio.html'
