const express = require('express');
const router = express.Router();

const {
    createBlocker,
    listBlockers,
    approveBlocker,
    rejectBlocker,
    resolveBlocker,
} = require('./blockers.controller');

const { authUser, requireRole } = require('../../shared/middleware/auth');
const { validate } = require('../../shared/validators/validate');
const {
    createBlockerSchema,
    approveBlockerSchema,
    rejectBlockerSchema,
    resolveBlockerSchema,
} = require('./blockers.validation');

// Listar bloqueadores de un item: cualquier rol autenticado
router.get('/', authUser, listBlockers);

// Crear bloqueador: viewer, pm o admin (el controller valida ownership)
router.post(
    '/',
    authUser,
    validate(createBlockerSchema),
    createBlocker
);

// Aprobar bloqueador: solo PM o admin
router.patch(
    '/:id/approve',
    authUser,
    requireRole('pm', 'admin'),
    validate(approveBlockerSchema),
    approveBlocker
);

// Rechazar bloqueador: solo PM o admin
router.patch(
    '/:id/reject',
    authUser,
    requireRole('pm', 'admin'),
    validate(rejectBlockerSchema),
    rejectBlocker
);

// Resolver bloqueador: viewer asignado al work item
router.patch(
    '/:id/resolve',
    authUser,
    validate(resolveBlockerSchema),
    resolveBlocker
);

module.exports = router;
