param location string = 'brazilsouth'
param containerLocation string = 'westus'
param resourceSuffix string = 'e4262df5'
param existingPlanName string = 'eventosfisi-api-${resourceSuffix}-plan'
var tags = { project: 'EventosFISI', purpose: 'taller-contenedores' }
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'eventosfisiacr${resourceSuffix}'
  location: location
  tags: tags
  sku: { name: 'Standard' }
  properties: { adminUserEnabled: false, publicNetworkAccess: 'Enabled' }
}
resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'eventosfisi-acr-pull-${resourceSuffix}'
  location: location
  tags: tags
}
resource pullPermission 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, pullIdentity.id, 'AcrPull')
  scope: registry
  properties: {
    principalId: pullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}
resource environment 'Microsoft.App/managedEnvironments@2026-03-02-preview' = {
  name: 'eventosfisi-env-docker-${resourceSuffix}'
  location: containerLocation
  tags: tags
  properties: {
    environmentMode: 'WorkloadProfiles'
    workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
    zoneRedundant: false
  }
}
resource plan 'Microsoft.Web/serverfarms@2023-12-01' existing = {
  name: existingPlanName
}
resource frontend 'Microsoft.Web/sites@2023-12-01' = {
  name: 'eventosfisi-web-${resourceSuffix}'
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'node /home/site/wwwroot/server.mjs'
      alwaysOn: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
        { name: 'ENABLE_ORYX_BUILD', value: 'false' }
      ]
    }
  }
}
output registryName string = registry.name
output registryServer string = registry.properties.loginServer
output pullIdentityId string = pullIdentity.id
output environmentId string = environment.id
output frontendName string = frontend.name
output frontendUrl string = 'https://${frontend.properties.defaultHostName}'
