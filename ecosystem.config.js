module.exports = {
  apps: [
    {
      name: 'md-youtube-summarizer',
      script: 'transcript_server.py',
      interpreter: './venv/bin/python',
      cwd: process.cwd(),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '4G',
      min_uptime: '10s',
      max_restarts: 5,
      env: {
        NODE_ENV: 'production',
        FLASK_ENV: 'production',
        PORT: 5003
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};
