const { z } = require('zod');

const createRiskSchema = z.object({
    id_project:  z.coerce.number({ message: 'id_project es requerido' }).int().positive(),
    title:       z.string({ message: 'title es requerido' }).min(1).max(200),
    description: z.string().max(1000).optional(),
    level:       z.enum(['low', 'medium', 'high'], {
        message: "level debe ser 'low', 'medium' o 'high'",
    }),
});

const updateRiskStatusSchema = z.object({
    status: z.enum(['closed', 'discarded'], {
        message: "status debe ser 'closed' o 'discarded'",
    }),
});

module.exports = { createRiskSchema, updateRiskStatusSchema };
