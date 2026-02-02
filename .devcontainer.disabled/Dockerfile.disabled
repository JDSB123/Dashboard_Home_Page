FROM mcr.microsoft.com/devcontainers/universal:latest

LABEL name="dashboard-gbsv-dev-codespace"
LABEL description="GBSV Dashboard Development Environment"

# Install additional system tools
RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-venv \
    jq \
    gh \
    && rm -rf /var/lib/apt/lists/*

# Install Azure Functions Core Tools v4
RUN curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg \
    && mv microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg \
    && sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/microsoft-ubuntu-$(lsb_release -cs)-prod $(lsb_release -cs) main" > /etc/apt/sources.list.d/dotnetdev.list' \
    && apt-get update \
    && apt-get install -y azure-functions-core-tools-4 \
    && rm -rf /var/lib/apt/lists/*

# Set up Node.js packages globally
RUN npm install -g \
    http-server \
    live-server \
    prettier \
    eslint \
    azurite \
    typescript

WORKDIR /workspaces/Dashboard_Home_Page
