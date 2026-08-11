const { join } = require('path');

/**
 * Store Chrome inside the server app directory so Render build + runtime share the same path.
 * @type {import('puppeteer').Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
