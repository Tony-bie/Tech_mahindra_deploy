const { z } = require('zod');

// CA-01: descripción obligatoria (min 10 chars)
// CA-02: severidad obligatoria (bajo/medio/crítico)
const createBlockerSchema = z.object({
    id_work_item: z.coerce.number({ message: 'id_work_item es requerido' }),
    id_project: z.coerce.number({ message: 'id_project es requerido' }),
    kind: z.enum(['blocker', 'implication'], {
        message: "kind debe ser 'blocker' o 'implication'",
    }),
    severity: z.enum(['low', 'medium', 'critical'], {
        message: "severity debe ser 'low', 'medium' o 'critical'",
    }),
    description: z.string()
        .min(10, 'La descripción debe tener al menos 10 caracteres')
        .max(1000, 'La descripción no puede exceder 1000 caracteres'),
    impact: z.string()
        .min(10, 'El impacto debe tener al menos 10 caracteres')
        .max(1000, 'El impacto no puede exceder 1000 caracteres'),
});

// Aprobar bloqueador
const approveBlockerSchema = z.object({
    approval_status: z.enum(['approved'], {
        message: "approval_status debe ser 'approved'",
    }),
    deadline: z.string().datetime({ message: 'deadline debe ser una fecha ISO válida' }),
});

// Resolver bloqueador (viewer)
const resolveBlockerSchema = z.object({});

// Rechazar bloqueador
const rejectBlockerSchema = z.object({
    approval_status: z.enum(['rejected'], {
        message: "approval_status debe ser 'rejected'",
    }),
    rejected_reason: z.string()
        .min(5, 'La razón de rechazo debe tener al menos 5 caracteres')
        .max(500, 'La razón de rechazo no puede exceder 500 caracteres'),
});

module.exports = {
    createBlockerSchema,
    approveBlockerSchema,
    rejectBlockerSchema,
    resolveBlockerSchema,
};
