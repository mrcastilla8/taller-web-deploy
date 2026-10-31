param location string = 'westus'
param resourceSuffix string = 'e4262df5'
param imageTag string
param frontendOrigin string
@secure()
param databaseUrl string

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: 'eventosfisi-env-docker-${resourceSuffix}'
}
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: 'eventosfisiacr${resourceSuffix}'
}
resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: 'eventosfisi-acr-pull-${resourceSuffix}'
}
resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'eventosfisi-docker-${resourceSuffix}'
  location: location
  tags: { project: 'EventosFISI', purpose: 'taller-contenedores' }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${pullIdentity.id}': {} }
  }
  properties: {
    managedEnvironmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 8080, transport: 'auto', allowInsecure: false }
      registries: [{ server: registry.properties.loginServer, identity: pullIdentity.id }]
      secrets: [{ name: 'database-url', value: databaseUrl }]
    }
    template: {
      containers: [{
        name: 'eventos-api'
        image: '${registry.properties.loginServer}/eventos-backend:${imageTag}'
        resources: { cpu: json('0.25'), memory: '0.5Gi' }
        env: [
          { name: 'NODE_ENV', value: 'production' }
          { name: 'HOST', value: '0.0.0.0' }
          { name: 'PORT', value: '8080' }
          { name: 'DATABASE_URL', secretRef: 'database-url' }
          { name: 'DB_SSL', value: 'require' }
          { name: 'CORS_ORIGINS', value: frontendOrigin }
        ]
        probes: [
          { type: 'Startup', httpGet: { path: '/health', port: 8080 }, initialDelaySeconds: 5, periodSeconds: 5, timeoutSeconds: 3, failureThreshold: 60 }
          { type: 'Liveness', httpGet: { path: '/health', port: 8080 }, periodSeconds: 30, timeoutSeconds: 5, failureThreshold: 3 }
          { type: 'Readiness', httpGet: { path: '/api/ready', port: 8080 }, periodSeconds: 10, timeoutSeconds: 5, failureThreshold: 3 }
        ]
      }]
      scale: { minReplicas: 0, maxReplicas: 1, rules: [{ name: 'http', http: { metadata: { concurrentRequests: '10' } } }] }
    }
  }
}
output backendUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
