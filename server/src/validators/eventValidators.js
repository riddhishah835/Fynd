import { z } from 'zod';

const categorySchema = z.enum([
  'tech',
  'cultural',
  'sports',
  'business',
  'music',
  'social',
  'other',
]);

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid event id');
const dateSchema = z.coerce.date();

export const tierSchema = z.object({
  name: z.string().trim().min(1).max(40),
  price: z.number().min(0),
  slots: z.number().int().min(1),
  benefits: z.array(z.string().trim().min(1)).min(1).max(10),
}).strict();

const createFields = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(3000),
  category: categorySchema,
  city: z.string().trim().min(1),
  venue: z.string().trim().min(1),
  startDate: dateSchema,
  endDate: dateSchema,
  expectedFootfall: z.number().int().min(0),
  audienceProfile: z.string().trim().min(1),
  tiers: z.array(tierSchema).max(6),
};

export const createEventSchema = z.object(createFields).strict().refine(
  ({ startDate, endDate }) => endDate >= startDate,
  { message: 'endDate must be on or after startDate', path: ['endDate'] },
);

const updateTierSchema = z.object({
  _id: objectId.optional(),
  name: z.string().trim().min(1).max(40).optional(),
  price: z.number().min(0).optional(),
  slots: z.number().int().min(1).optional(),
  benefits: z.array(z.string().trim().min(1)).min(1).max(10).optional(),
}).strict().superRefine((tier, context) => {
  if (!tier._id && (
    tier.name === undefined ||
    tier.price === undefined ||
    tier.slots === undefined ||
    tier.benefits === undefined
  )) {
    context.addIssue({
      code: 'custom',
      message: 'New tiers require name, price, slots, and benefits',
    });
  }
});

export const updateEventSchema = z.object({
  title: createFields.title.optional(),
  description: createFields.description.optional(),
  category: createFields.category.optional(),
  city: createFields.city.optional(),
  venue: createFields.venue.optional(),
  startDate: createFields.startDate.optional(),
  endDate: createFields.endDate.optional(),
  expectedFootfall: createFields.expectedFootfall.optional(),
  audienceProfile: createFields.audienceProfile.optional(),
  tiers: z.array(updateTierSchema).max(6).optional(),
}).strict().superRefine((event, context) => {
  if (
    event.startDate !== undefined &&
    event.endDate !== undefined &&
    event.endDate < event.startDate
  ) {
    context.addIssue({
      code: 'custom',
      message: 'endDate must be on or after startDate',
      path: ['endDate'],
    });
  }
});

export const listEventsQuerySchema = z.object({
  q: z.string().trim().optional(),
  city: z.string().trim().optional(),
  category: categorySchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minFootfall: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
}).strict().refine(
  ({ from, to }) => from === undefined || to === undefined || from <= to,
  { message: 'from must be on or before to', path: ['to'] },
);

export const eventIdParamSchema = z.object({ id: objectId }).strict();
