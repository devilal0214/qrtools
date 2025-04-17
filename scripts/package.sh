#!/bin/bash

# Create production build
npm run build

# Create dist directory
mkdir -p dist

# Copy necessary files
cp -r .next dist/
cp -r public dist/
cp package.json dist/
cp package-lock.json dist/
cp next.config.js dist/

# Create ZIP archive
zip -r deployment.zip dist/*
