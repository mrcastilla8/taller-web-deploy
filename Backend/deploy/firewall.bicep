param postgresServerName string
param ipAddresses array

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' existing = {
  name: postgresServerName
}

resource rules 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = [for (ip, index) in ipAddresses: {
  parent: postgres
  name: 'app-service-${index}'
  properties: { startIpAddress: ip, endIpAddress: ip }
}]
