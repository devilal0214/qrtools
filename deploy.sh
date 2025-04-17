#!/bin/bash
# Build the application
npm run build

# Create a production build archive
tar -czf qrcode-build.tar.gz .next node_modules package.json package-lock.json public
