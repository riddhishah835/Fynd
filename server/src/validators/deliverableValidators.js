import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');

export const updateDeliverableSchema = z.object({
  status: z.enum(['delivered', 'approved', 'disputed']),
  note: z.string().max(500).optional(),
}).strict();

export const deliverableIdParamSchema = z.object({ id: objectId }).strict();
