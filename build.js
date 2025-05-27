// build.js - Script build ứng dụng (ES modules)
import { execSync } from 'child_process';
import fs from 'fs';
import * as dotenv from 'dotenv';
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

console.log(`\n${colors.bright}${colors.blue}===== BUILD ỨNG DỤNG =====${colors.reset}\n`);

try {
  // Bước 1: Kiểm tra môi trường
  console.log(`${colors.bright}${colors.yellow}Bước 1: Chuẩn bị môi trường build...${colors.reset}`);
  
  // Tải biến môi trường production
  if (fs.existsSync('.env.production')) {
    console.log(`${colors.green}Sử dụng file .env.production${colors.reset}`);
    dotenv.config({ path: '.env.production' });
  } else {
    console.log(`${colors.yellow}Cảnh báo: Không tìm thấy file .env.production${colors.reset}`);
    // Tạo file tạm thời
    fs.writeFileSync('.env.production', 'NODE_ENV=production\nPORT=3001\nVITE_API_BASE_URL=http://localhost:3001');
    console.log(`${colors.blue}Đã tạo file .env.production tạm thời${colors.reset}`);
    dotenv.config({ path: '.env.production' });
  }
  
  // Bước 2: Build frontend
  console.log(`\n${colors.bright}${colors.yellow}Bước 2: Build React frontend...${colors.reset}`);
  
  // Xóa thư mục dist cũ nếu tồn tại
  if (fs.existsSync('dist')) {
    console.log(`${colors.yellow}Xóa thư mục dist cũ...${colors.reset}`);
    fs.rmSync('dist', { recursive: true, force: true });
    console.log(`${colors.green}Đã xóa thư mục dist cũ${colors.reset}`);
  }
  
  // Build React với Vite
  console.log(`${colors.blue}Chạy build...${colors.reset}`);
  execSync('vite build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  console.log(`\n${colors.green}✓ Build frontend thành công!${colors.reset}`);
  
  // Kiểm tra kết quả build
  if (fs.existsSync('dist') && fs.existsSync('dist/index.html')) {
    const distFiles = fs.readdirSync('dist');
    console.log(`${colors.blue}Các file đã tạo trong thư mục dist:${colors.reset}`);
    distFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    
    console.log(`\n${colors.bright}${colors.green}✅ Build hoàn tất! Ứng dụng đã sẵn sàng để triển khai.${colors.reset}`);
    console.log(`${colors.yellow}Sử dụng lệnh ${colors.reset}npm run deploy${colors.yellow} để triển khai với PM2.${colors.reset}\n`);
  } else {
    console.log(`\n${colors.red}⚠️ Cảnh báo: Không tìm thấy các file build trong thư mục dist.${colors.reset}`);
    console.log(`${colors.yellow}Kiểm tra lại cấu hình Vite và quá trình build.${colors.reset}\n`);
  }
  
} catch (error) {
  console.error(`\n${colors.red}❌ Lỗi trong quá trình build:${colors.reset}`, error);
  process.exit(1);
}