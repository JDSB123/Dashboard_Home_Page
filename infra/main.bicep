// ════════════════════════════════════════════════════════════════════════════
// GBSV Dashboard - Azure Front Door Infrastructure
// ════════════════════════════════════════════════════════════════════════════
// This template deploys Azure Front Door Standard/Premium with:
// - Custom domain (www.greenbiersportventures.com)
// - Path-based routing to Static Web App and Container Apps
// - WAF policy for API protection
// - Global CDN edge caching
// ════════════════════════════════════════════════════════════════════════════

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('Azure region for Front Door (global service)')
param location string = 'global'

@description('Enable WAF policy')
param enableWaf bool = true

@description('Front Door SKU')
@allowed(['Standard_AzureFrontDoor', 'Premium_AzureFrontDoor'])
param skuName string = 'Standard_AzureFrontDoor'

// ════════════════════════════════════════════════════════════════════════════
// Backend Origins Configuration
// ════════════════════════════════════════════════════════════════════════════

@description('Static Web App hostname')
param staticWebAppHostname string = 'proud-cliff-008e2e20f.2.azurestaticapps.net'

@description('Orchestrator Container App hostname')
param orchestratorHostname string = 'gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io'

@description('NBA API Container App hostname')
param nbaApiHostname string = 'nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io'

@description('NCAAM API Container App hostname')
param ncaamApiHostname string = 'ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io'

@description('NFL API Container App hostname')
param nflApiHostname string = 'nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io'

@description('NCAAF API Container App hostname')
param ncaafApiHostname string = 'ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io'

// ════════════════════════════════════════════════════════════════════════════
// Variables
// ════════════════════════════════════════════════════════════════════════════

var frontDoorName = 'gbsv-frontdoor-${environment}'
var wafPolicyName = 'gbsvwafpolicy${environment}'
var endpointName = 'gbsv-endpoint-${environment}'

// Origin group names
var originGroupDashboard = 'og-dashboard'
var originGroupOrchestrator = 'og-orchestrator'
var originGroupNba = 'og-nba-api'
var originGroupNcaam = 'og-ncaam-api'
var originGroupNfl = 'og-nfl-api'
var originGroupNcaaf = 'og-ncaaf-api'

// ════════════════════════════════════════════════════════════════════════════
// WAF Policy
// NOTE: Standard SKU does not support managed rule sets (OWASP, Bot Manager).
// Only custom rules (rate limiting) are used. Upgrade to Premium for full WAF.
// ════════════════════════════════════════════════════════════════════════════

resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2024-02-01' = if (enableWaf) {
  name: wafPolicyName
  location: location
  sku: {
    name: skuName
  }
  properties: {
    policySettings: {
      mode: 'Prevention'
      requestBodyCheck: 'Enabled'
      customBlockResponseStatusCode: 403
      customBlockResponseBody: base64('{"error": "Request blocked by WAF policy"}')
    }
    // NOTE: managedRules removed - requires Premium SKU (~$330/month vs $35/month)
    // To enable managed rules (OWASP, Bot Manager), change skuName to 'Premium_AzureFrontDoor'
    customRules: {
      rules: [
        {
          name: 'RateLimitRule'
          priority: 100
          ruleType: 'RateLimitRule'
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: 1000
          matchConditions: [
            {
              matchVariable: 'RequestUri'
              operator: 'Contains'
              matchValue: ['/api/']
            }
          ]
          action: 'Block'
        }
      ]
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Front Door Profile
// ════════════════════════════════════════════════════════════════════════════

resource frontDoorProfile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: frontDoorName
  location: location
  sku: {
    name: skuName
  }
  properties: {
    originResponseTimeoutSeconds: 60
  }
  tags: {
    environment: environment
    project: 'gbsv-dashboard'
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Front Door Endpoint
// ════════════════════════════════════════════════════════════════════════════

resource frontDoorEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: frontDoorProfile
  name: endpointName
  location: location
  properties: {
    enabledState: 'Enabled'
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Origin Groups
// ════════════════════════════════════════════════════════════════════════════

// Dashboard (Static Web App) Origin Group
resource originGroupDashboardResource 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: originGroupDashboard
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'HEAD'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 100
    }
    sessionAffinityState: 'Disabled'
  }
}

// Orchestrator API Origin Group
resource originGroupOrchestratorResource 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: originGroupOrchestrator
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/api/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

// NBA API Origin Group
resource originGroupNbaResource 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: originGroupNba
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

// NCAAM API Origin Group
resource originGroupNcaamResource 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: originGroupNcaam
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

// NFL API Origin Group
resource originGroupNflResource 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: originGroupNfl
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

// NCAAF API Origin Group
resource originGroupNcaafResource 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: originGroupNcaaf
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Origins (Backend Servers)
// ════════════════════════════════════════════════════════════════════════════

// Dashboard Origin (Static Web App)
resource originDashboard 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroupDashboardResource
  name: 'origin-dashboard'
  properties: {
    hostName: staticWebAppHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: staticWebAppHostname
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// Orchestrator Origin
resource originOrchestrator 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroupOrchestratorResource
  name: 'origin-orchestrator'
  properties: {
    hostName: orchestratorHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: orchestratorHostname
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// NBA API Origin
resource originNba 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroupNbaResource
  name: 'origin-nba-api'
  properties: {
    hostName: nbaApiHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: nbaApiHostname
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// NCAAM API Origin
resource originNcaam 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroupNcaamResource
  name: 'origin-ncaam-api'
  properties: {
    hostName: ncaamApiHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: ncaamApiHostname
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// NFL API Origin
resource originNfl 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroupNflResource
  name: 'origin-nfl-api'
  properties: {
    hostName: nflApiHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: nflApiHostname
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// NCAAF API Origin
resource originNcaaf 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroupNcaafResource
  name: 'origin-ncaaf-api'
  properties: {
    hostName: ncaafApiHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: ncaafApiHostname
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Rule Sets for Path Rewriting
// ════════════════════════════════════════════════════════════════════════════

resource ruleSet 'Microsoft.Cdn/profiles/ruleSets@2024-02-01' = {
  parent: frontDoorProfile
  name: 'UrlRewriteRules'
}

// Rule to strip /api/nba prefix when forwarding to NBA backend
// Enforce canonical host: redirect any non-approved host to www.greenbiersportventures.com
resource ruleCanonicalHost 'Microsoft.Cdn/profiles/ruleSets/rules@2024-02-01' = {
  parent: ruleSet
  name: 'EnforceCanonicalHost'
  properties: {
    order: 0
    conditions: [
      {
        name: 'RequestHeader'
        parameters: {
          typeName: 'DeliveryRuleRequestHeaderConditionParameters'
          selector: 'Host'
          operator: 'Equal'
          negateCondition: true
          matchValues: [
            'www.greenbiersportventures.com'
            'greenbiersportventures.com'
          ]
        }
      }
    ]
    actions: [
      {
        name: 'UrlRedirect'
        parameters: {
          typeName: 'DeliveryRuleUrlRedirectActionParameters'
          redirectType: 'Moved'
          destinationProtocol: 'Https'
          customHostname: 'www.greenbiersportventures.com'
        }
      }
    ]
  }
}

// Rule to strip /api/nba prefix when forwarding to NBA backend
resource ruleNbaRewrite 'Microsoft.Cdn/profiles/ruleSets/rules@2024-02-01' = {
  parent: ruleSet
  name: 'RewriteNBA'
  properties: {
    order: 1
    conditions: [
      {
        name: 'UrlPath'
        parameters: {
          typeName: 'DeliveryRuleUrlPathMatchConditionParameters'
          operator: 'BeginsWith'
          matchValues: ['/api/nba/']
          transforms: ['Lowercase']
        }
      }
    ]
    actions: [
      {
        name: 'UrlRewrite'
        parameters: {
          typeName: 'DeliveryRuleUrlRewriteActionParameters'
          sourcePattern: '/api/nba/'
          destination: '/'
          preserveUnmatchedPath: true
        }
      }
    ]
  }
}

// Rule to strip /api/ncaam prefix
resource ruleNcaamRewrite 'Microsoft.Cdn/profiles/ruleSets/rules@2024-02-01' = {
  parent: ruleSet
  name: 'RewriteNCAAM'
  properties: {
    order: 3
    conditions: [
      {
        name: 'UrlPath'
        parameters: {
          typeName: 'DeliveryRuleUrlPathMatchConditionParameters'
          operator: 'BeginsWith'
          matchValues: ['/api/ncaam/']
          transforms: ['Lowercase']
        }
      }
    ]
    actions: [
      {
        name: 'UrlRewrite'
        parameters: {
          typeName: 'DeliveryRuleUrlRewriteActionParameters'
          sourcePattern: '/api/ncaam/'
          destination: '/'
          preserveUnmatchedPath: true
        }
      }
    ]
  }
}

// Rule to strip /api/nfl prefix
resource ruleNflRewrite 'Microsoft.Cdn/profiles/ruleSets/rules@2024-02-01' = {
  parent: ruleSet
  name: 'RewriteNFL'
  properties: {
    order: 2
    conditions: [
      {
        name: 'UrlPath'
        parameters: {
          typeName: 'DeliveryRuleUrlPathMatchConditionParameters'
          operator: 'BeginsWith'
          matchValues: ['/api/nfl/']
          transforms: ['Lowercase']
        }
      }
    ]
    actions: [
      {
        name: 'UrlRewrite'
        parameters: {
          typeName: 'DeliveryRuleUrlRewriteActionParameters'
          sourcePattern: '/api/nfl/'
          destination: '/'
          preserveUnmatchedPath: true
        }
      }
    ]
  }
}

// Rule to strip /api/ncaaf prefix
resource ruleNcaafRewrite 'Microsoft.Cdn/profiles/ruleSets/rules@2024-02-01' = {
  parent: ruleSet
  name: 'RewriteNCAAF'
  properties: {
    order: 4
    conditions: [
      {
        name: 'UrlPath'
        parameters: {
          typeName: 'DeliveryRuleUrlPathMatchConditionParameters'
          operator: 'BeginsWith'
          matchValues: ['/api/ncaaf/']
          transforms: ['Lowercase']
        }
      }
    ]
    actions: [
      {
        name: 'UrlRewrite'
        parameters: {
          typeName: 'DeliveryRuleUrlRewriteActionParameters'
          sourcePattern: '/api/ncaaf/'
          destination: '/'
          preserveUnmatchedPath: true
        }
      }
    ]
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Routes
// ════════════════════════════════════════════════════════════════════════════

// NBA API Route (/api/nba/*)
resource routeNbaApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-nba-api'
  properties: {
    originGroup: {
      id: originGroupNbaResource.id
    }
    originPath: '/'
    ruleSets: [
      {
        id: ruleSet.id
      }
    ]
    supportedProtocols: ['Https']
    patternsToMatch: ['/api/nba/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    originNba
    ruleNbaRewrite
  ]
}

// NCAAM API Route (/api/ncaam/*)
resource routeNcaamApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-ncaam-api'
  properties: {
    originGroup: {
      id: originGroupNcaamResource.id
    }
    originPath: '/'
    ruleSets: [
      {
        id: ruleSet.id
      }
    ]
    supportedProtocols: ['Https']
    patternsToMatch: ['/api/ncaam/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    originNcaam
    ruleNcaamRewrite
  ]
}

// NFL API Route (/api/nfl/*)
resource routeNflApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-nfl-api'
  properties: {
    originGroup: {
      id: originGroupNflResource.id
    }
    originPath: '/'
    ruleSets: [
      {
        id: ruleSet.id
      }
    ]
    supportedProtocols: ['Https']
    patternsToMatch: ['/api/nfl/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    originNfl
    ruleNflRewrite
  ]
}

// NCAAF API Route (/api/ncaaf/*)
resource routeNcaafApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-ncaaf-api'
  properties: {
    originGroup: {
      id: originGroupNcaafResource.id
    }
    originPath: '/'
    ruleSets: [
      {
        id: ruleSet.id
      }
    ]
    supportedProtocols: ['Https']
    patternsToMatch: ['/api/ncaaf/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    originNcaaf
    ruleNcaafRewrite
  ]
}

// Orchestrator API Route (/api/*) - catches all other /api/ requests
resource routeOrchestratorApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-orchestrator-api'
  properties: {
    originGroup: {
      id: originGroupOrchestratorResource.id
    }
    supportedProtocols: ['Https']
    patternsToMatch: ['/api/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    originOrchestrator
    // Ensure sport-specific routes are created first (more specific routes take precedence)
    routeNbaApi
    routeNcaamApi
    routeNflApi
    routeNcaafApi
  ]
}

// Dashboard Route (/*) - default catch-all
resource routeDashboard 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-dashboard'
  properties: {
    originGroup: {
      id: originGroupDashboardResource.id
    }
    supportedProtocols: ['Https', 'Http']
    patternsToMatch: ['/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
    cacheConfiguration: {
      queryStringCachingBehavior: 'UseQueryString'
      compressionSettings: {
        isCompressionEnabled: true
        contentTypesToCompress: [
          'text/html'
          'text/css'
          'application/javascript'
          'application/json'
          'image/svg+xml'
        ]
      }
    }
  }
  dependsOn: [
    originDashboard
    routeOrchestratorApi
  ]
}

// ════════════════════════════════════════════════════════════════════════════
// Security Policy (WAF Association)
// ════════════════════════════════════════════════════════════════════════════

resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2024-02-01' = if (enableWaf) {
  parent: frontDoorProfile
  name: 'waf-policy-association'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {
        id: wafPolicy.id
      }
      associations: [
        {
          domains: [
            {
              id: frontDoorEndpoint.id
            }
          ]
          // Azure Front Door Standard requires '/*' pattern for security policies
          // Rate limiting for /api/* is handled within the WAF custom rules
          patternsToMatch: ['/*']
        }
      ]
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Outputs
// ════════════════════════════════════════════════════════════════════════════

@description('Front Door profile name')
output frontDoorName string = frontDoorProfile.name

@description('Front Door endpoint hostname')
output frontDoorEndpointHostname string = frontDoorEndpoint.properties.hostName

@description('Front Door endpoint URL')
output frontDoorUrl string = 'https://${frontDoorEndpoint.properties.hostName}'

@description('Front Door profile ID')
output frontDoorProfileId string = frontDoorProfile.id

@description('WAF policy ID')
output wafPolicyId string = enableWaf ? wafPolicy.id : ''

@description('Endpoint ID for custom domain association')
output endpointId string = frontDoorEndpoint.id
