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

@description('Front Door SKU - Premium includes WAF managed rules (OWASP, Bot Manager)')
@allowed(['Standard_AzureFrontDoor', 'Premium_AzureFrontDoor'])
param skuName string = 'Premium_AzureFrontDoor'

// ════════════════════════════════════════════════════════════════════════════
// Backend Origins Configuration
// ════════════════════════════════════════════════════════════════════════════

@description('Static Web App hostname')
param staticWebAppHostname string = 'proud-cliff-008e2e20f.2.azurestaticapps.net'

// NOTE: Dashboard Orchestrator REMOVED - redundant
// Each sport API has built-in async queue processing at /{sport}/predictions
// No need for orchestrator middleman

<<<<<<< Updated upstream
@description('NBA API Container App hostname')
param nbaApiHostname string = 'gbsv-nbav3-aca.wittypebble-41c11c65.eastus.azurecontainerapps.io'

@description('NCAAM API Container App hostname')
param ncaamApiHostname string = 'ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io'

@description('NFL API Container App hostname')
param nflApiHostname string = 'nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io'

@description('NCAAF API Container App hostname')
param ncaafApiHostname string = 'ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io'
=======
// Sport model hostnames removed — models live in their own repos/resource groups
>>>>>>> Stashed changes

// ════════════════════════════════════════════════════════════════════════════
// Variables
// ════════════════════════════════════════════════════════════════════════════

var frontDoorName = 'gbsv-frontdoor-${environment}'
var wafPolicyName = 'gbsvwafpolicy${environment}'
var endpointName = 'gbsv-endpoint-${environment}'

// Origin group names
var originGroupDashboard = 'og-dashboard'
<<<<<<< Updated upstream
var originGroupNba = 'og-nba-api'
var originGroupNcaam = 'og-ncaam-api'
var originGroupNfl = 'og-nfl-api'
var originGroupNcaaf = 'og-ncaaf-api'
=======
var originGroupOrchestrator = 'og-orchestrator'

>>>>>>> Stashed changes

// ════════════════════════════════════════════════════════════════════════════
// WAF Policy (Premium - Full OWASP + Bot Manager protection)
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
    // Managed rules only available for Premium SKU
    managedRules: skuName == 'Premium_AzureFrontDoor'
      ? {
          managedRuleSets: [
            {
              ruleSetType: 'Microsoft_DefaultRuleSet'
              ruleSetVersion: '2.1'
              ruleSetAction: 'Block'
            }
            {
              ruleSetType: 'Microsoft_BotManagerRuleSet'
              ruleSetVersion: '1.0'
              ruleSetAction: 'Block'
            }
          ]
        }
      : {
          managedRuleSets: []
        }
    customRules: {
      rules: [
        {
          name: 'RateLimitSportEndpoints'
          priority: 100
          ruleType: 'RateLimitRule'
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: 1000
          matchConditions: [
            {
              matchVariable: 'RequestUri'
              operator: 'RegEx'
              matchValue: ['^/(nba|ncaam|nfl|ncaaf)/']
            }
          ]
          action: 'Block'
        }
        {
          name: 'RateLimitPredictions'
          priority: 200
          ruleType: 'RateLimitRule'
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: 100 // Stricter limit for expensive prediction endpoints
          matchConditions: [
            {
              matchVariable: 'RequestUri'
              operator: 'RegEx'
              matchValue: ['^/(nba|ncaam|nfl|ncaaf)/predictions']
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
    originResponseTimeoutSeconds: 240 // Extended for full slate processing (10-15 games)
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

<<<<<<< Updated upstream
// NBA API Origin Group
resource originGroupNbaResource 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: originGroupNba
=======
// Orchestrator API Origin Group
resource originGroupOrchestratorResource 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: originGroupOrchestrator
>>>>>>> Stashed changes
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
<<<<<<< Updated upstream
      probePath: '/health'
=======
      probePath: '/api/health'
>>>>>>> Stashed changes
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes


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

<<<<<<< Updated upstream
// NBA API Origin
resource originNba 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroupNbaResource
  name: 'origin-nba-api'
  properties: {
    hostName: nbaApiHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: nbaApiHostname
=======
// Orchestrator Origin
resource originOrchestrator 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroupOrchestratorResource
  name: 'origin-orchestrator'
  properties: {
    hostName: orchestratorHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: orchestratorHostname
>>>>>>> Stashed changes
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes


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

<<<<<<< Updated upstream
// NOTE: No URL rewrite rules needed for sport routes
// Front Door routes /{sport}/* directly to sport APIs
// Sport APIs expect paths like /nba/predictions, /health, etc. at root
=======

>>>>>>> Stashed changes

// ════════════════════════════════════════════════════════════════════════════
// Routes (Direct Sport Routing - No /api/ prefix)
// ════════════════════════════════════════════════════════════════════════════
// URL Pattern: www.greenbiersportventures.com/{sport}/predictions
// Examples:
//   - /nba/predictions   → NBA API
//   - /ncaam/predictions → NCAAM API
//   - /nfl/predictions   → NFL API
//   - /ncaaf/predictions → NCAAF API
// ════════════════════════════════════════════════════════════════════════════

<<<<<<< Updated upstream
// NBA API Route (/nba/*)
resource routeNbaApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-nba'
  properties: {
    originGroup: {
      id: originGroupNbaResource.id
    }
    ruleSets: [
      {
        id: ruleSet.id
      }
    ]
    supportedProtocols: ['Https']
    patternsToMatch: ['/nba/*']
=======
// Orchestrator API Route (/api/*) - catches all /api/ requests
resource routeOrchestratorApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-orchestrator-api'
  properties: {
    originGroup: {
      id: originGroupOrchestratorResource.id
    }
    supportedProtocols: ['Https']
    patternsToMatch: ['/api/*']
>>>>>>> Stashed changes
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
<<<<<<< Updated upstream
    originNba
  ]
}

// NCAAM API Route (/ncaam/*)
resource routeNcaamApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-ncaam'
  properties: {
    originGroup: {
      id: originGroupNcaamResource.id
    }
    ruleSets: [
      {
        id: ruleSet.id
      }
    ]
    supportedProtocols: ['Https']
    patternsToMatch: ['/ncaam/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    originNcaam
  ]
}

// NFL API Route (/nfl/*)
resource routeNflApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-nfl'
  properties: {
    originGroup: {
      id: originGroupNflResource.id
    }
    ruleSets: [
      {
        id: ruleSet.id
      }
    ]
    supportedProtocols: ['Https']
    patternsToMatch: ['/nfl/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    originNfl
  ]
}

// NCAAF API Route (/ncaaf/*)
resource routeNcaafApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'route-ncaaf'
  properties: {
    originGroup: {
      id: originGroupNcaafResource.id
    }
    ruleSets: [
      {
        id: ruleSet.id
      }
    ]
    supportedProtocols: ['Https']
    patternsToMatch: ['/ncaaf/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    originNcaaf
  ]
}

// Dashboard Route (/*) - default catch-all for Static Web App
=======
    originOrchestrator
  ]
}

// Dashboard Route (/*) - default catch-all
>>>>>>> Stashed changes
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
    // Ensure sport routes are created first (more specific patterns take precedence)
    routeNbaApi
    routeNcaamApi
    routeNflApi
    routeNcaafApi
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
