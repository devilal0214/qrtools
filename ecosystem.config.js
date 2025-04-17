module.exports = {
  apps: [{
    name: 'qr-tool',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
