// ════════════════════════════════════════════════════════════════════════════
// Custom Domain Configuration for Azure Front Door
// ════════════════════════════════════════════════════════════════════════════
// Run this AFTER main.bicep deployment to add custom domain
// Requires DNS validation - see deployment script for instructions
// ════════════════════════════════════════════════════════════════════════════

@description('Front Door profile name')
param frontDoorProfileName string

@description('Front Door endpoint name')
param frontDoorEndpointName string

@description('Custom domain name (e.g., www.greenbiersportventures.com)')
param customDomainName string = 'www.greenbiersportventures.com'

@description('Enable HTTPS with Front Door managed certificate')
param enableManagedCertificate bool = true

// ════════════════════════════════════════════════════════════════════════════
// Variables
// ════════════════════════════════════════════════════════════════════════════

// Custom domain resource name must be alphanumeric with hyphens only
var customDomainResourceName = replace(replace(customDomainName, '.', '-'), '_', '-')

// ════════════════════════════════════════════════════════════════════════════
// References
// ════════════════════════════════════════════════════════════════════════════

resource frontDoorProfile 'Microsoft.Cdn/profiles@2024-02-01' existing = {
  name: frontDoorProfileName
}

resource frontDoorEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' existing = {
  parent: frontDoorProfile
  name: frontDoorEndpointName
}

// ════════════════════════════════════════════════════════════════════════════
// Custom Domain
// ════════════════════════════════════════════════════════════════════════════

resource customDomain 'Microsoft.Cdn/profiles/customDomains@2024-02-01' = {
  parent: frontDoorProfile
  name: customDomainResourceName
  properties: {
    hostName: customDomainName
    tlsSettings: enableManagedCertificate ? {
      certificateType: 'ManagedCertificate'
      minimumTlsVersion: 'TLS12'
    } : null
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Update Routes to Include Custom Domain
// ════════════════════════════════════════════════════════════════════════════

// Note: After custom domain is validated, you need to update routes to include it
// This requires re-deploying the routes with customDomains array

// ════════════════════════════════════════════════════════════════════════════
// Outputs
// ════════════════════════════════════════════════════════════════════════════

@description('Custom domain resource ID')
output customDomainId string = customDomain.id

@description('Custom domain validation state')
output validationState string = customDomain.properties.validationProperties.validationToken ?? 'pending'

@description('DNS TXT record name for validation')
output dnsTxtRecordName string = '_dnsauth.${customDomainName}'

@description('DNS TXT record value for validation')
output dnsTxtRecordValue string = customDomain.properties.validationProperties.validationToken ?? ''

@description('DNS CNAME record value (point your domain here)')
output dnsCnameTarget string = frontDoorEndpoint.properties.hostName
