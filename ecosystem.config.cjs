// PM2 process file. Hostinger's Node.js hosting runs your app under a
// process manager; if yours uses PM2, this config keeps the app alive
// and restarts it on crash.
module.exports = {
  apps: [
    {
      name: 'rag-app',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
