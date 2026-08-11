const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { downloadBrowsers } = require('puppeteer/lib/cjs/puppeteer/node/install.js');

const cacheDir = path.resolve(process.cwd(), '.cache', 'puppeteer');

function verifyChrome() {
  try {
    const executablePath = puppeteer.executablePath();
    return fs.existsSync(executablePath) ? executablePath : null;
  } catch {
    return null;
  }
}

async function main() {
  let executablePath = verifyChrome();

  if (!executablePath) {
    if (fs.existsSync(cacheDir)) {
      console.log('Removing incomplete Puppeteer cache...');
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }

    console.log('Installing Chrome via Puppeteer (cache:', cacheDir, ')...');
    await downloadBrowsers();
    executablePath = verifyChrome();
  }

  if (!executablePath) {
    console.error('Puppeteer Chrome install failed: executable not found.');
    process.exit(1);
  }

  console.log('Puppeteer Chrome ready.');
}

main().catch((error) => {
  console.error('Puppeteer Chrome install failed:', error.message);
  process.exit(1);
});
