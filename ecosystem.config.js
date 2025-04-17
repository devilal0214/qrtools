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
