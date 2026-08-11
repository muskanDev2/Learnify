const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cacheDir =
  process.env.PUPPETEER_CACHE_DIR || path.join(process.cwd(), '.cache', 'puppeteer');
process.env.PUPPETEER_CACHE_DIR = path.isAbsolute(cacheDir)
  ? cacheDir
  : path.join(process.cwd(), cacheDir);

function resolveChromeExecutable() {
  try {
    const puppeteer = require('puppeteer');
    const executablePath = puppeteer.executablePath();
    return fs.existsSync(executablePath) ? executablePath : null;
  } catch {
    return null;
  }
}

function removeCache() {
  const target = path.join(process.cwd(), '.cache', 'puppeteer');
  if (fs.existsSync(target)) {
    console.log('Removing incomplete Puppeteer cache...');
    fs.rmSync(target, { recursive: true, force: true });
  }
}

let executablePath = resolveChromeExecutable();

if (!executablePath) {
  removeCache();
  console.log('Installing Chrome for Puppeteer...');
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    env: process.env,
  });
  executablePath = resolveChromeExecutable();
}

if (!executablePath) {
  console.error('Puppeteer Chrome install failed: executable not found.');
  process.exit(1);
}

console.log('Puppeteer Chrome ready.');
