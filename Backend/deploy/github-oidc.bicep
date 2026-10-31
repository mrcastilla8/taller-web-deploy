param location string = 'brazilsouth'
param resourceSuffix string = 'e4262df5'
param githubRepository string = 'mrcastilla8/taller-web-deploy'
param githubOwnerId string = '143348512'
param githubRepositoryId string = '1432363006'

resource deploymentIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'eventosfisi-github-deploy-${resourceSuffix}'
  location: location
  tags: { project: 'EventosFISI', purpose: 'github-actions' }
}
resource federation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deploymentIdentity
  name: 'github-master'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${split(githubRepository, '/')[0]}@${githubOwnerId}/${split(githubRepository, '/')[1]}@${githubRepositoryId}:ref:refs/heads/master'
    audiences: ['api://AzureADTokenExchange']
  }
}
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = { name: 'eventosfisiacr${resourceSuffix}' }
resource frontend 'Microsoft.Web/sites@2023-12-01' existing = { name: 'eventosfisi-web-${resourceSuffix}' }
resource backend 'Microsoft.App/containerApps@2024-03-01' existing = { name: 'eventosfisi-docker-${resourceSuffix}' }
resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = { name: 'eventosfisi-acr-pull-${resourceSuffix}' }
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' existing = { name: 'eventosfisi-pg-${resourceSuffix}' }
resource egressRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' existing = {
  parent: postgres
  name: 'container-app-egress'
}
resource updateEgressRule 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(egressRule.id, deploymentIdentity.id, 'UpdateEgressRule')
  scope: egressRule
  properties: {
    principalId: deploymentIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
  }
}
resource reader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, deploymentIdentity.id, 'Reader')
  properties: {
    principalId: deploymentIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'acdd72a7-3385-48ef-bd42-f606fba81ae7')
  }
}
resource registryPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, deploymentIdentity.id, 'AcrPush')
  scope: registry
  properties: {
    principalId: deploymentIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8311e382-0749-4cb8-b61a-304f252e45ec')
  }
}
resource frontendPublish 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(frontend.id, deploymentIdentity.id, 'WebsiteContributor')
  scope: frontend
  properties: {
    principalId: deploymentIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'de139f84-1756-47ae-9be6-808fbbe84772')
  }
}
resource backendPublish 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(backend.id, deploymentIdentity.id, 'ContainerAppsContributor')
  scope: backend
  properties: {
    principalId: deploymentIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '358470bc-b998-42bd-ab17-a7e34c199c0f')
  }
}
resource usePullIdentity 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(pullIdentity.id, deploymentIdentity.id, 'ManagedIdentityOperator')
  scope: pullIdentity
  properties: {
    principalId: deploymentIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'f1a07417-d97a-45cb-824c-7a7467783830')
  }
}
output clientId string = deploymentIdentity.properties.clientId
output tenantId string = tenant().tenantId
output subscriptionId string = subscription().subscriptionId
