import { Router } from 'express';
import { draft, extract, matches } from '../controllers/aiController.js';
import aiRateLimit from '../middleware/aiRateLimit.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  draftProposalSchema,
  extractEventSchema,
} from '../validators/aiValidators.js';

const router = Router();

router.post(
  '/draft-proposal',
  requireAuth,
  requireRole('sponsor'),
  aiRateLimit,
  validate(draftProposalSchema),
  draft,
);
router.post(
  '/extract-event',
  requireAuth,
  requireRole('organizer'),
  aiRateLimit,
  validate(extractEventSchema),
  extract,
);
router.get('/matches', requireAuth, requireRole('sponsor'), aiRateLimit, matches);

export default router;
