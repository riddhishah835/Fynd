import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { create as createMessage, list as listMessages } from '../controllers/messageController.js';
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
import {
  createMessageSchema,
  listMessagesQuerySchema,
} from '../validators/messageValidators.js';

const router = Router();
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user._id.toString(),
  skip: () => config.nodeEnv === 'test',
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
        details: [],
      },
    });
  },
});

router.post('/', requireAuth, requireRole('sponsor'), validate(createProposalSchema), create);
router.get('/', requireAuth, validate(listProposalsQuerySchema, 'query'), list);
router.get(
  '/:id/messages',
  requireAuth,
  validate(proposalIdParamSchema, 'params'),
  validate(listMessagesQuerySchema, 'query'),
  listMessages,
);
router.post(
  '/:id/messages',
  requireAuth,
  messageLimiter,
  validate(proposalIdParamSchema, 'params'),
  validate(createMessageSchema),
  createMessage,
);
router.get('/:id', requireAuth, validate(proposalIdParamSchema, 'params'), get);
router.post(
  '/:id/transition',
  requireAuth,
  validate(proposalIdParamSchema, 'params'),
  validate(transitionSchema),
  transition,
);

export default router;
