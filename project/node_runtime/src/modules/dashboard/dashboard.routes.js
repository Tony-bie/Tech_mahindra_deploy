const express = require('express');
const router = express.Router();
const { getAdminDashboard } = require('./dashboard.controller');
const { authUser, requireRole } = require('../../shared/middleware/auth');

router.get('/admin', authUser, requireRole('admin'), getAdminDashboard);

module.exports = router;
