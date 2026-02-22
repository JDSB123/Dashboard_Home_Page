// Creates minimal tables needed for local health checks against Azurite
// Local-only script; safe and does not touch Azure resources.

const { TableClient } = require("@azure/data-tables");

async function ensureTable(tableName, connectionString) {
  const client = TableClient.fromConnectionString(connectionString, tableName);
  try {
    await client.createTable();
    console.log(`Created table '${tableName}'.`);
  } catch (err) {
    // 409 Conflict if exists in Azurite; different SDKs may emit various messages
    if (err.statusCode === 409 || /TableAlreadyExists|Conflict/i.test(err.message)) {
      console.log(`Table '${tableName}' already exists.`);
    } else {
      throw err;
    }
  }
}

(async () => {
  try {
    const conn = process.env.AzureWebJobsStorage || "UseDevelopmentStorage=true";
    // From Health check: expects a table named 'modelregistry'
    await ensureTable("modelregistry", conn);
    console.log("Local table seeding complete.");
    process.exit(0);
  } catch (e) {
    console.error("Failed to seed local tables:", e.message || e);
    process.exit(1);
  }
})();
