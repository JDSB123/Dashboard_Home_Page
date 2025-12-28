FROM mcr.microsoft.com/azure-functions/node:4-node18

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    HOME=/home/site/wwwroot

WORKDIR /home/site/wwwroot

COPY package*.json ./
RUN npm install --production

COPY . .
