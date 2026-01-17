FROM mcr.microsoft.com/devcontainers/universal:latest

# Install additional tools
RUN apt-get update && apt-get install -y \
    python3-pip \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

# Set up Node.js packages globally
RUN npm install -g \
    http-server \
    live-server \
    prettier \
    eslint

WORKDIR /workspace
