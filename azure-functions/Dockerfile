FROM mcr.microsoft.com/azure-functions/node:4-node20

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    HOME=/home/site/wwwroot

# Runtime environment variables - passed at container start, not baked in
# Required: AzureSignalRConnectionString, AZURE_STORAGE_CONNECTION_STRING
# Optional: SDIO_KEY, ODDS_API_KEY, BASKETBALL_API_KEY, APPLICATIONINSIGHTS_CONNECTION_STRING

WORKDIR /home/site/wwwroot

COPY package*.json ./
RUN npm install --production

COPY . .

# Remove local settings file (secrets should come from environment)
RUN rm -f local.settings.json
