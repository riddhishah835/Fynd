import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const draftProposalSchema = z.object({
  eventId: objectId,
  tierId: objectId,
  tone: z.enum(['professional', 'friendly', 'concise']).default('professional'),
}).strict();

export const extractEventSchema = z.object({
  text: z.string().trim().min(30).max(5000),
}).strict();

const extractedTierSchema = z.object({
  name: z.string().nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  slots: z.number().int().min(1).nullable().optional(),
  benefits: z.array(z.string()).min(1).max(6).nullable().optional(),
}).strict();

export const aiEventResultSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.enum(['tech', 'cultural', 'sports', 'business', 'music', 'social', 'other'])
    .nullable().optional(),
  city: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  startDate: dateString.nullable().optional(),
  endDate: dateString.nullable().optional(),
  expectedFootfall: z.number().int().min(0).nullable().optional(),
  audienceProfile: z.string().nullable().optional(),
  tiers: z.array(extractedTierSchema).max(4).nullable().optional(),
}).strict();

export const aiEventResultJsonSchema = {
  type: 'object',
  properties: {
    title: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    category: {
      type: ['string', 'null'],
      enum: ['tech', 'cultural', 'sports', 'business', 'music', 'social', 'other', null],
    },
    city: { type: ['string', 'null'] },
    venue: { type: ['string', 'null'] },
    startDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    endDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    expectedFootfall: { type: ['integer', 'null'], minimum: 0 },
    audienceProfile: { type: ['string', 'null'] },
    tiers: {
      type: ['array', 'null'],
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          name: { type: ['string', 'null'] },
          price: { type: ['number', 'null'], minimum: 0 },
          slots: { type: ['integer', 'null'], minimum: 1 },
          benefits: {
            type: ['array', 'null'],
            minItems: 1,
            maxItems: 6,
            items: { type: 'string' },
          },
        },
        required: ['name', 'price', 'slots', 'benefits'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'title',
    'description',
    'category',
    'city',
    'venue',
    'startDate',
    'endDate',
    'expectedFootfall',
    'audienceProfile',
    'tiers',
  ],
  additionalProperties: false,
};
