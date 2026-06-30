module.exports = {
  apps: [
    {
      name: 'peacock-socket',
      script: 'server/socket-server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        SOCKET_PORT: 3001,
      },
    },
    {
      name: 'peacock-web',
      script: 'npm',
      args: 'start',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
