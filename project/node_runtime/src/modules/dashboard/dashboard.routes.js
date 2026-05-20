const express = require('express');
const router = express.Router();
const { getAdminDashboard, getLeaderboard } = require('./dashboard.controller');
const { authUser, requireRole } = require('../../shared/middleware/auth');

router.get('/admin',       authUser, requireRole('admin'), getAdminDashboard);
router.get('/leaderboard', authUser, getLeaderboard);

module.exports = router;
