// proxy.js - Run both frontend and backend (ES modules)
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Lấy __dirname trong ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

console.log(`${colors.bright}${colors.cyan}Starting development environment...${colors.reset}\n`);

// Start the backend server
const backendProcess = spawn('node', ['server.js'], { 
  stdio: 'pipe',
  shell: true
});

// Start the frontend development server
const frontendProcess = spawn('npx', ['vite'], { 
  stdio: 'pipe',
  shell: true
});

// Handle backend process output
backendProcess.stdout.on('data', (data) => {
  console.log(`${colors.green}[Backend] ${colors.reset}${data.toString().trim()}`);
});

backendProcess.stderr.on('data', (data) => {
  console.error(`${colors.red}[Backend Error] ${colors.reset}${data.toString().trim()}`);
});

// Handle frontend process output
frontendProcess.stdout.on('data', (data) => {
  console.log(`${colors.blue}[Frontend] ${colors.reset}${data.toString().trim()}`);
});

frontendProcess.stderr.on('data', (data) => {
  console.error(`${colors.magenta}[Frontend Error] ${colors.reset}${data.toString().trim()}`);
});

// Handle process termination
const cleanup = () => {
  if (backendProcess) {
    backendProcess.kill();
    console.log(`${colors.yellow}Backend process terminated${colors.reset}`);
  }
  
  if (frontendProcess) {
    frontendProcess.kill();
    console.log(`${colors.yellow}Frontend process terminated${colors.reset}`);
  }
  
  process.exit(0);
};

// Handle termination signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log(`${colors.bright}${colors.cyan}Development environment started${colors.reset}`);
console.log(`${colors.cyan}Press Ctrl+C to stop both servers${colors.reset}`);