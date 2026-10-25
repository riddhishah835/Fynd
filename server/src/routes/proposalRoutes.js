import { Router } from 'express';
import {
  create,
  get,
  list,
  transition,
} from '../controllers/proposalController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createProposalSchema,
  listProposalsQuerySchema,
  proposalIdParamSchema,
  transitionSchema,
} from '../validators/proposalValidators.js';

const router = Router();

router.post('/', requireAuth, requireRole('sponsor'), validate(createProposalSchema), create);
router.get('/', requireAuth, validate(listProposalsQuerySchema, 'query'), list);
router.get('/:id', requireAuth, validate(proposalIdParamSchema, 'params'), get);
router.post(
  '/:id/transition',
  requireAuth,
  validate(proposalIdParamSchema, 'params'),
  validate(transitionSchema),
  transition,
);

export default router;
