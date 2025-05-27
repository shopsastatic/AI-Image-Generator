// deploy.js - Script triển khai đơn giản (ES modules)
import { execSync } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Lấy __dirname trong ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Màu sắc cho output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m', 
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

// Hiển thị tiêu đề
console.log(`\n${colors.bright}${colors.blue}===== TRIỂN KHAI ỨNG DỤNG =====${colors.reset}\n`);

try {
  // Bước 1: Build frontend với Vite
  console.log(`${colors.bright}${colors.yellow}Bước 1: Build frontend...${colors.reset}`);
  execSync('npm run build', { stdio: 'inherit' });
  console.log(`${colors.green}✓ Build frontend thành công!${colors.reset}`);
  console.log(`  - Các file tĩnh đã được tạo trong thư mục ./dist\n`);

  // Bước 2: Tạo thư mục logs nếu chưa tồn tại
  if (!fs.existsSync('logs')) {
    console.log(`${colors.yellow}Tạo thư mục logs...${colors.reset}`);
    fs.mkdirSync('logs');
    console.log(`${colors.green}✓ Đã tạo thư mục logs${colors.reset}\n`);
  }

  // Bước 3: Tạo file cấu hình PM2
  console.log(`${colors.bright}${colors.yellow}Bước 2: Tạo file cấu hình PM2...${colors.reset}`);
  
  const pm2Config = {
    apps: [{
      name: "ai-image-app",
      script: "server.js",
      exec_mode: "fork",
      instances: "1",
      env: {
        NODE_ENV: "production",
        PORT: 30012
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      error_file: "logs/error.log",
      out_file: "logs/out.log"
    }]
  };

  fs.writeFileSync('ecosystem.config.json', JSON.stringify(pm2Config, null, 2));
  console.log(`${colors.green}✓ File cấu hình PM2 đã được tạo!${colors.reset}\n`);

  // Bước 4: Chạy ứng dụng với PM2
  console.log(`${colors.bright}${colors.yellow}Bước 3: Triển khai ứng dụng với PM2...${colors.reset}`);
  
  // Kiểm tra xem ứng dụng đã chạy trên PM2 chưa
  try {
    const pm2List = execSync('pm2 list').toString();
    if (pm2List.includes('ai-image-app')) {
      // Nếu đã tồn tại, reload
      console.log(`${colors.blue}Ứng dụng đã tồn tại trên PM2, đang reload...${colors.reset}`);
      execSync('pm2 reload ecosystem.config.json', { stdio: 'inherit' });
    } else {
      // Nếu chưa tồn tại, start mới
      console.log(`${colors.blue}Khởi động ứng dụng mới với PM2...${colors.reset}`);
      execSync('pm2 start ecosystem.config.json', { stdio: 'inherit' });
    }
  } catch (e) {
    // PM2 có thể chưa được cài đặt hoặc lỗi khác
    console.log(`${colors.blue}Khởi động ứng dụng với PM2...${colors.reset}`);
    execSync('pm2 start ecosystem.config.json', { stdio: 'inherit' });
  }

  console.log(`${colors.green}✓ Ứng dụng đã được triển khai thành công!${colors.reset}\n`);
  
  // Hiển thị thông tin ứng dụng
  console.log(`${colors.bright}${colors.blue}===== THÔNG TIN ỨNG DỤNG =====${colors.reset}`);
  execSync('pm2 info ai-image-app', { stdio: 'inherit' });
  
  console.log(`\n${colors.bright}${colors.green}Triển khai hoàn tất! Ứng dụng đang chạy.${colors.reset}`);
  console.log(`${colors.yellow}Để xem logs: ${colors.reset}pm2 logs ai-image-app`);
  console.log(`${colors.yellow}Để theo dõi hiệu suất: ${colors.reset}pm2 monit\n`);

} catch (error) {
  console.error(`${colors.red}Lỗi trong quá trình triển khai:${colors.reset}`, error);
  process.exit(1);
}