// ecosystem.config.js - Cấu hình PM2 tối ưu
module.exports = {
  apps: [
    {
      name: "ai-miseninc-admin",
      script: "server.js",
      exec_mode: "fork",
      watch: false,
      instances: 1,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 30012
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      time: true
    }
  ]
};