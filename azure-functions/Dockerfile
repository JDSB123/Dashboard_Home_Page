FROM mcr.microsoft.com/azure-functions/node:4-node20

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    HOME=/home/site/wwwroot

# Install Python 3 for TelegramRunner child process
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/bin/python3 /usr/bin/python

# Runtime environment variables - passed at container start, not baked in
# Required: AzureSignalRConnectionString, AZURE_STORAGE_CONNECTION_STRING
# Optional: SDIO_KEY, ODDS_API_KEY, BASKETBALL_API_KEY, APPLICATIONINSIGHTS_CONNECTION_STRING

WORKDIR /home/site/wwwroot

COPY package*.json ./
RUN npm install --production

COPY . .

# Remove local settings file (secrets should come from environment)
RUN rm -f local.settings.json
