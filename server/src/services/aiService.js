import Event from '../models/Event.js';
import AppError from '../utils/AppError.js';
import {
  aiEventResultJsonSchema,
  aiEventResultSchema,
} from '../validators/aiValidators.js';
import { chat, chatJSON } from './llm.js';

function fitProposalMessage(content) {
  const trimmed = content.trim();
  if (trimmed.length <= 1000) return trimmed;

  const underLimit = trimmed.slice(0, 1000);
  const sentenceMatches = [...underLimit.matchAll(/[.!?](?=\s|$)/g)];
  if (sentenceMatches.length) {
    return underLimit.slice(0, sentenceMatches.at(-1).index + 1).trim();
  }

  const lastSpace = underLimit.lastIndexOf(' ');
  const clipped = underLimit.slice(0, lastSpace > 0 ? lastSpace : 999).trim();
  return `${clipped.replace(/[.!?]*$/, '')}.`;
}

export async function draftProposal(sponsor, { eventId, tierId, tone }) {
  const event = await Event.findById(eventId);
  if (!event || event.status !== 'published') {
    throw new AppError('NOT_FOUND', 'Event not found');
  }

  const tier = event.tiers.id(tierId);
  if (!tier) {
    throw new AppError('NOT_FOUND', 'Tier not found');
  }

  const sponsorData = {
    organization: sponsor.organization,
    industry: sponsor.industry ?? '',
    targetAudience: sponsor.targetAudience ?? '',
    goals: sponsor.goals ?? '',
    city: sponsor.city,
    budgetMin: sponsor.budgetMin ?? null,
    budgetMax: sponsor.budgetMax ?? null,
  };
  const eventData = {
    title: event.title,
    category: event.category,
    city: event.city,
    audienceProfile: event.audienceProfile,
  };

  const response = await chat({
    maxTokens: 800,
    messages: [
      {
        role: 'system',
        content: [
          'Write an 80 to 150 word sponsorship proposal message from the sponsor to the event organizer.',
          `Use a ${tone} tone, plain text, first person plural.`,
          'Reference the sponsor goals and the event audience, and name the sponsorship tier.',
          'Use only the supplied facts. Do not invent facts or numbers.',
          'Do not include placeholders, a subject line, or markdown.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({ sponsor: sponsorData, event: eventData, tier: tier.name }),
      },
    ],
  });

  const draft = fitProposalMessage(response.content ?? '');
  if (!draft) {
    throw new AppError(
      'AI_UNAVAILABLE',
      'AI returned an empty draft. Please try again.',
      503,
    );
  }
  return { draft };
}

export async function extractEvent(text) {
  const today = new Date().toISOString().slice(0, 10);
  const parsed = await chatJSON({
    schema: aiEventResultSchema,
    jsonSchema: aiEventResultJsonSchema,
    maxTokens: 1600,
    messages: [
      {
        role: 'system',
        content: [
          `Today is ${today}. Extract event details from the supplied text.`,
          'Extract only details explicitly stated; use null for unknown values and never invent numbers.',
          'Resolve relative dates such as "next Friday" to real YYYY-MM-DD dates using today.',
          'Suggest up to 3 sponsorship tiers only if prices or sponsorship levels are mentioned.',
          'Otherwise return an empty tiers array.',
          'Write description as a concise event summary based only on the supplied text.',
          'If the source contains any event details, do not return a null or empty description.',
          'Return exactly these keys: title, description, category, city, venue, startDate,',
          'endDate, expectedFootfall, audienceProfile, tiers.',
          'Every unknown scalar must be null. Every known field must use the requested type.',
          'Each tier must contain exactly name, price, slots, benefits.',
          'Use YYYY-MM-DD or null for dates. If there are no stated sponsorship levels, tiers must be [].',
        ].join(' '),
      },
      { role: 'user', content: text },
    ],
  });

  const description = parsed.description?.trim() || text.trim();
  return {
    event: {
      ...parsed,
      description: description.slice(0, 3000),
    },
  };
}
