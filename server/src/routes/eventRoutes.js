import { Router } from 'express';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  listMyEvents,
  loadOwnedEvent,
  publishEvent,
  updateEvent,
  uploadEventBanner,
} from '../controllers/eventController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import {
  createEventSchema,
  eventIdParamSchema,
  listEventsQuerySchema,
  updateEventSchema,
} from '../validators/eventValidators.js';

const router = Router();
const organizerOnly = [requireAuth, requireRole('organizer')];
const eventId = validate(eventIdParamSchema, 'params');

router.get(
  '/',
  requireAuth,
  validate(listEventsQuerySchema, 'query'),
  listEvents,
);
router.get('/mine/list', ...organizerOnly, listMyEvents);
router.get('/:id', requireAuth, eventId, getEvent);
router.post('/', ...organizerOnly, validate(createEventSchema), createEvent);
router.put(
  '/:id',
  ...organizerOnly,
  eventId,
  loadOwnedEvent,
  validate(updateEventSchema),
  updateEvent,
);
router.post(
  '/:id/publish',
  ...organizerOnly,
  eventId,
  loadOwnedEvent,
  publishEvent,
);
router.delete('/:id', ...organizerOnly, eventId, loadOwnedEvent, deleteEvent);
router.post(
  '/:id/banner',
  ...organizerOnly,
  eventId,
  loadOwnedEvent,
  upload.single('banner'),
  uploadEventBanner,
);

export default router;
