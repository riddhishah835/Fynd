import { z } from 'zod';

const commonSignupFields = {
  name: z.string().trim().min(2).max(60),
  email: z.email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/, 'Password must include a letter')
    .regex(/[0-9]/, 'Password must include a number'),
  organization: z.string().trim().min(1),
  city: z.string().trim().min(1),
  bio: z.string().trim().optional(),
  website: z.string().trim().optional(),
};

const sponsorSignupSchema = z
  .object({
    ...commonSignupFields,
    role: z.literal('sponsor'),
    industry: z.string().trim().min(1),
    targetAudience: z.string().trim().min(1),
    budgetMin: z.number().min(0),
    budgetMax: z.number().min(0),
    goals: z.string().trim().min(1),
  })
  .refine((data) => data.budgetMax >= data.budgetMin, {
    message: 'budgetMax must be greater than or equal to budgetMin',
    path: ['budgetMax'],
  });

export const signupSchema = z.discriminatedUnion('role', [
  z.object({
    ...commonSignupFields,
    role: z.literal('organizer'),
    orgType: z.enum(['college', 'club', 'community', 'other']),
  }),
  sponsorSignupSchema,
]);

export const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  organization: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  bio: z.string().trim().optional(),
  website: z.string().trim().optional(),
  orgType: z.enum(['college', 'club', 'community', 'other']).optional(),
  industry: z.string().trim().min(1).optional(),
  targetAudience: z.string().trim().min(1).optional(),
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  goals: z.string().trim().min(1).optional(),
}).refine(
  ({ budgetMin, budgetMax }) =>
    budgetMin === undefined || budgetMax === undefined || budgetMax >= budgetMin,
  {
    message: 'budgetMax must be greater than or equal to budgetMin',
    path: ['budgetMax'],
  },
);
