const router = require('express').Router();
const pool = require('../config/db');
const { isMorphReady } = require('../utils/textComparison');

router.get('/', async (req, res) => {
  let dbStatus = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    dbStatus = 'error';
  }

  const healthStatus = {
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    morphology: isMorphReady() ? 'ready' : 'fallback',
    version: '3.0.0',
    memory: process.memoryUsage(),
  };

  res.status(dbStatus === 'ok' ? 200 : 503).json(healthStatus);
});

module.exports = router;