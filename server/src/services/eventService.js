import AppError from '../utils/AppError.js';

export function assertOwner(event, user) {
  if (event.organizer._id?.toString?.() !== user._id.toString()
    && event.organizer.toString() !== user._id.toString()) {
    throw new AppError('FORBIDDEN', 'You do not have permission to do this');
  }
}

export function applyTierUpdate(event, incomingTiers) {
  const currentTiers = event.tiers;
  const tiersById = new Map(currentTiers.map((tier) => [tier._id.toString(), tier]));
  const retainedIds = new Set();
  const newTiers = [];

  for (const incoming of incomingTiers) {
    if (!incoming._id) {
      newTiers.push({ ...incoming, slotsFilled: 0 });
      continue;
    }

    const current = tiersById.get(incoming._id);
    if (!current) {
      throw new AppError('VALIDATION_ERROR', 'Tier does not belong to this event');
    }

    retainedIds.add(incoming._id);

    if (current.slotsFilled > 0) {
      if (incoming.price !== undefined && incoming.price !== current.price) {
        throw new AppError('CONFLICT', 'Cannot change the price of a tier with accepted proposals');
      }
      if (incoming.slots !== undefined && incoming.slots < current.slotsFilled) {
        throw new AppError('CONFLICT', 'Tier slots cannot be reduced below slots already filled');
      }
    }

    for (const [field, value] of Object.entries(incoming)) {
      if (field !== '_id' && value !== undefined) {
        current[field] = value;
      }
    }
  }

  for (const current of currentTiers) {
    if (!retainedIds.has(current._id.toString()) && current.slotsFilled > 0) {
      throw new AppError('CONFLICT', 'Cannot remove a tier with accepted proposals');
    }
  }

  const finalTiers = currentTiers.filter((tier) => retainedIds.has(tier._id.toString()));
  finalTiers.push(...newTiers);

  if (finalTiers.length > 6) {
    throw new AppError('VALIDATION_ERROR', 'An event can have at most 6 tiers');
  }

  event.tiers = finalTiers;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildEventFilter(query) {
  const filter = {
    status: 'published',
    endDate: { $gte: new Date() },
  };

  if (query.q) {
    const search = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [
      { title: search },
      { description: search },
      { city: search },
      { venue: search },
      { audienceProfile: search },
      { category: search },
    ];
  }

  if (query.city) {
    filter.city = new RegExp(`^${escapeRegex(query.city)}$`, 'i');
  }
  if (query.category) {
    filter.category = query.category;
  }
  if (query.from || query.to) {
    filter.startDate = {};
    if (query.from) filter.startDate.$gte = query.from;
    if (query.to) filter.startDate.$lte = query.to;
  }
  if (query.maxPrice !== undefined) {
    filter.tiers = { $elemMatch: { price: { $lte: query.maxPrice } } };
  }
  if (query.minFootfall !== undefined) {
    filter.expectedFootfall = { $gte: query.minFootfall };
  }

  return filter;
}

export function validateForPublish(event) {
  if (event.tiers.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'An event must have at least one tier before publishing');
  }
  if (event.endDate <= new Date()) {
    throw new AppError('VALIDATION_ERROR', 'Event endDate must be in the future before publishing');
  }
}
