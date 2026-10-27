import { z } from 'zod';

export const createMessageSchema = z.object({
  text: z.string().trim().min(1).max(1000),
}).strict();

export const listMessagesQuerySchema = z.object({
  after: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
}).strict();
