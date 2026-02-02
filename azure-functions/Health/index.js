/**
 * Health check endpoint for orchestrator monitoring
 */
const { TableClient } = require("@azure/data-tables");

module.exports = async function (context, req) {
  const healthChecks = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || "unknown",
    checks: {},
  };

  try {
    // Check storage connectivity
    if (process.env.AzureWebJobsStorage) {
      try {
        const tableClient = TableClient.fromConnectionString(
          process.env.AzureWebJobsStorage,
          "modelregistry"
        );
        // Try to list one entity to verify connectivity
        const iterator = tableClient.listEntities({ maxPageSize: 1 });
        await iterator.next();
        healthChecks.checks.storage = { status: "healthy", message: "Storage accessible" };
      } catch (error) {
        healthChecks.checks.storage = { status: "unhealthy", message: error.message };
        healthChecks.status = "unhealthy";
      }
    } else {
      healthChecks.checks.storage = { status: "unknown", message: "Storage not configured" };
    }

    // Check SignalR configuration
    if (process.env.AZURE_SIGNALR_CONNECTION_STRING) {
      healthChecks.checks.signalr = { status: "healthy", message: "SignalR configured" };
    } else {
      healthChecks.checks.signalr = { status: "warning", message: "SignalR not configured" };
      healthChecks.status = healthChecks.status === "healthy" ? "degraded" : healthChecks.status;
    }

    // Check Application Insights
    if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
      healthChecks.checks.monitoring = {
        status: "healthy",
        message: "Application Insights configured",
      };
    } else {
      healthChecks.checks.monitoring = {
        status: "warning",
        message: "Application Insights not configured",
      };
    }

    // Check model endpoints
    const models = ["NBA", "NCAAM", "NFL", "NCAAF"];
    let allModelsConfigured = true;
    models.forEach((model) => {
      const envVar = `${model}_API_URL`;
      if (process.env[envVar]) {
        healthChecks.checks[`model_${model.toLowerCase()}`] = {
          status: "healthy",
          endpoint: process.env[envVar],
        };
      } else {
        healthChecks.checks[`model_${model.toLowerCase()}`] = {
          status: "warning",
          message: "Endpoint not configured",
        };
        allModelsConfigured = false;
      }
    });

    if (!allModelsConfigured && healthChecks.status === "healthy") {
      healthChecks.status = "degraded";
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    healthChecks.checks.memory = {
      status: "healthy",
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + " MB",
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + " MB",
    };

    // Uptime
    healthChecks.uptime = Math.round(process.uptime()) + " seconds";
  } catch (error) {
    context.log.error("Health check error:", error);
    healthChecks.status = "unhealthy";
    healthChecks.error = error.message;
  }

  // Return appropriate status code based on health
  const statusCode =
    healthChecks.status === "healthy" ? 200 : healthChecks.status === "degraded" ? 200 : 503;

  context.res = {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
    body: healthChecks,
  };
};
