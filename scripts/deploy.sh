#!/bin/bash

echo "Building application..."
npm run build

echo "Creating PM2 ecosystem config..."
cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: 'qr-generator',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: '3000'
    }
  }]
}
EOL

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
