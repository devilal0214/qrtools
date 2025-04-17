#!/bin/bash

# Pull latest changes
git pull

# Install dependencies
npm install

# Build application
npm run build

# Reload PM2
npm run pm2:reload
