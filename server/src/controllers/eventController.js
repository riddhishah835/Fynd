import Event from '../models/Event.js';
import AppError from '../utils/AppError.js';
import {
  applyTierUpdate,
  assertOwner,
  buildEventFilter,
  validateForPublish,
} from '../services/eventService.js';
import { uploadBanner } from '../config/cloudinary.js';

function populateOrganizer(query) {
  return query.populate('organizer', 'name organization city');
}

export async function loadOwnedEvent(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      throw new AppError('NOT_FOUND', 'Event not found');
    }
    assertOwner(event, req.user);
    req.event = event;
    next();
  } catch (error) {
    next(error);
  }
}

export async function listEvents(req, res, next) {
  try {
    const { page, limit } = req.query;
    const filter = buildEventFilter(req.query);
    const [events, total] = await Promise.all([
      populateOrganizer(Event.find(filter))
        .sort({ startDate: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    res.json({
      events,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function listMyEvents(req, res, next) {
  try {
    const events = await Event.find({ organizer: req.user._id }).sort({ createdAt: -1 });
    res.json({ events });
  } catch (error) {
    next(error);
  }
}

export async function getEvent(req, res, next) {
  try {
    const event = await populateOrganizer(Event.findById(req.params.id));
    if (!event) {
      throw new AppError('NOT_FOUND', 'Event not found');
    }

    if (event.status !== 'published' && event.organizer._id.toString() !== req.user._id.toString()) {
      throw new AppError('NOT_FOUND', 'Event not found');
    }

    res.json({ event });
  } catch (error) {
    next(error);
  }
}

export async function createEvent(req, res, next) {
  try {
    const event = await Event.create({
      ...req.body,
      organizer: req.user._id,
      status: 'draft',
    });
    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
}

export async function updateEvent(req, res, next) {
  try {
    const { tiers, ...fields } = req.body;

    if (req.event.status === 'closed') {
      throw new AppError('CONFLICT', 'Closed events cannot be edited');
    }

    Object.assign(req.event, fields);
    if (req.event.endDate < req.event.startDate) {
      throw new AppError('VALIDATION_ERROR', 'endDate must be on or after startDate');
    }
    if (tiers !== undefined) {
      applyTierUpdate(req.event, tiers);
    }

    await req.event.save();
    res.json({ event: req.event });
  } catch (error) {
    next(error);
  }
}

export async function publishEvent(req, res, next) {
  try {
    if (req.event.status === 'published') {
      throw new AppError('CONFLICT', 'Event is already published');
    }

    validateForPublish(req.event);
    req.event.status = 'published';
    // TODO: generate embedding on publish in AI milestone
    await req.event.save();
    res.json({ event: req.event });
  } catch (error) {
    next(error);
  }
}

export async function deleteEvent(req, res, next) {
  try {
    if (req.event.tiers.some((tier) => tier.slotsFilled > 0)) {
      throw new AppError('CONFLICT', 'Cannot delete an event with accepted proposals');
    }

    // TODO: also refuse if any non-terminal proposals exist once proposals are built
    await req.event.deleteOne();
    res.json({ message: 'Event deleted' });
  } catch (error) {
    next(error);
  }
}

export async function uploadEventBanner(req, res, next) {
  try {
    if (!req.file || !Buffer.isBuffer(req.file.buffer) || req.file.buffer.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'A non-empty image file is required');
    }

    req.event.bannerUrl = await uploadBanner(req.file.buffer);
    await req.event.save();
    res.json({ event: req.event });
  } catch (error) {
    if (error.cloudinaryError) {
      console.error('Cloudinary banner upload failed:', {
        message: error.cloudinaryError.message,
        http_code: error.cloudinaryError.http_code,
        name: error.cloudinaryError.name,
      });
    }
    next(error);
  }
}
