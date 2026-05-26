// project/node_runtime/src/modules/audit/audit.routes.js
const express = require('express');
const router = express.Router();
const { listAudit } = require('./audit.controller');
const { authUser, requireRole } = require('../../shared/middleware/auth');

// CA-03: solo GET — no exponemos PATCH/PUT/DELETE.
router.get('/', authUser, requireRole('admin', 'pm'), listAudit);

module.exports = router;
