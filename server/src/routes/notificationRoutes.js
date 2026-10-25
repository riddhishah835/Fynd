import { Router } from 'express';
import {
  list,
  markAllRead,
  markRead,
} from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notificationIdParamSchema } from '../validators/proposalValidators.js';

const router = Router();

router.get('/', requireAuth, list);
router.patch('/:id/read', requireAuth, validate(notificationIdParamSchema, 'params'), markRead);
router.post('/read-all', requireAuth, markAllRead);

export default router;
