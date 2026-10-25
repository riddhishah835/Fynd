import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');
const proposalStatuses = [
  'pending',
  'countered',
  'accepted',
  'rejected',
  'withdrawn',
  'completed',
];

export const createProposalSchema = z.object({
  eventId: objectId,
  tierId: objectId,
  amount: z.number().positive(),
  message: z.string().trim().min(10).max(1000),
}).strict();

export const transitionSchema = z.object({
  toStatus: z.enum(proposalStatuses),
  amount: z.number().positive().optional(),
  note: z.string().max(500).optional(),
}).strict();

export const listProposalsQuerySchema = z.object({
  status: z.enum(proposalStatuses).optional(),
}).strict();

export const notificationIdParamSchema = z.object({ id: objectId }).strict();

export const proposalIdParamSchema = z.object({ id: objectId }).strict();
