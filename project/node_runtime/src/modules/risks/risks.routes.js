const express = require('express');
const router  = express.Router();

const { listRisks, createRisk, updateRiskStatus, deleteRisk } = require('./risks.controller');
const { authUser, requireRole }   = require('../../shared/middleware/auth');
const { validate }                = require('../../shared/validators/validate');
const { createRiskSchema, updateRiskStatusSchema } = require('./risks.validation');

router.get('/', authUser, listRisks);

router.post(
    '/',
    authUser,
    requireRole('pm', 'admin'),
    validate(createRiskSchema),
    createRisk
);

router.patch(
    '/:id/status',
    authUser,
    requireRole('pm', 'admin'),
    validate(updateRiskStatusSchema),
    updateRiskStatus
);

router.delete(
    '/:id',
    authUser,
    requireRole('pm', 'admin'),
    deleteRisk
);

module.exports = router;
