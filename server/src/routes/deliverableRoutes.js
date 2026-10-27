import { Router } from 'express';
import {
  update,
  uploadProof,
} from '../controllers/deliverableController.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import {
  deliverableIdParamSchema,
  updateDeliverableSchema,
} from '../validators/deliverableValidators.js';

const router = Router();

router.patch(
  '/:id',
  requireAuth,
  validate(deliverableIdParamSchema, 'params'),
  validate(updateDeliverableSchema),
  update,
);
router.post(
  '/:id/proof',
  requireAuth,
  validate(deliverableIdParamSchema, 'params'),
  upload.proof('proof'),
  uploadProof,
);

export default router;
