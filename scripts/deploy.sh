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
