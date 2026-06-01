const express = require('express');
const router = express.Router();
const { getAdminDashboard, getLeaderboard, getPmDashboard, getViewerDashboard } = require('./dashboard.controller');
const { authUser, requireRole } = require('../../shared/middleware/auth');

router.get('/admin',       authUser, requireRole('admin'),          getAdminDashboard);
router.get('/pm',          authUser, requireRole('pm', 'admin'),    getPmDashboard);
router.get('/viewer',      authUser, requireRole('viewer', 'admin'), getViewerDashboard);
router.get('/leaderboard', authUser, getLeaderboard);

module.exports = router;
