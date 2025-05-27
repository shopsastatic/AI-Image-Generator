// ecosystem.config.js - Cấu hình PM2 tối ưu
module.exports = {
  apps: [
    {
      name: "ai-miseninc",
      script: "server.js",
      instances: "max", // Sử dụng tất cả CPU cores
      exec_mode: "cluster", // Chế độ cluster để tối ưu hiệu suất
      watch: false,
      max_memory_restart: "500M", // Khởi động lại nếu sử dụng quá 500MB
      env: {
        NODE_ENV: "production",
        PORT: 3001
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      time: true
    }
  ]
};