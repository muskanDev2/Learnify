const express = require('express');
const healthRoutes = require('./health.routes');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Learnify backend',
    docs: 'Use /api/health to check server and database status',
  });
});

router.use('/health', healthRoutes);

module.exports = router;
