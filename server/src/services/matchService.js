import { z } from 'zod';
import Event from '../models/Event.js';
import Proposal from '../models/Proposal.js';
import User from '../models/User.js';
import { chatJSON } from './llm.js';
import { embedSponsor } from './embeddingService.js';

const cacheTtlMs = 10 * 60 * 1000;
const matchCache = new Map();
const reasonSchema = z.object({
  reasons: z.array(z.object({
    eventId: z.string(),
    reason: z.string(),
  })),
});

const projectedEventFields = {
  _id: 1,
  organizer: 1,
  title: 1,
  description: 1,
  category: 1,
  city: 1,
  venue: 1,
  startDate: 1,
  endDate: 1,
  expectedFootfall: 1,
  audienceProfile: 1,
  bannerUrl: 1,
  status: 1,
  tiers: 1,
  createdAt: 1,
};

export async function vectorCandidates(queryEmbedding, limit = 20) {
  return Event.aggregate([
    {
      $vectorSearch: {
        index: 'event_embedding_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit,
        filter: {
          status: { $eq: 'published' },
          endDate: { $gte: new Date() },
        },
      },
    },
    {
      $project: {
        ...projectedEventFields,
        semantic: { $meta: 'vectorSearchScore' },
      },
    },
  ]);
}

export const candidateProvider = {
  vectorCandidates,
  fallbackCandidates: null,
};

export async function fallbackCandidates(sponsor) {
  const city = (sponsor.city ?? '').trim().toLowerCase();
  const candidates = await Event.aggregate([
    {
      $match: {
        status: 'published',
        endDate: { $gte: new Date() },
      },
    },
    {
      $addFields: {
        _cityMatch: {
          $cond: [
            { $eq: [{ $toLower: { $ifNull: ['$city', ''] } }, city] },
            1,
            0,
          ],
        },
      },
    },
    { $sort: { _cityMatch: -1, createdAt: -1 } },
    { $limit: 20 },
    {
      $project: {
        ...projectedEventFields,
        semantic: { $literal: null },
      },
    },
  ]);
  return candidates;
}

candidateProvider.fallbackCandidates = fallbackCandidates;

function normalize(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function scoreCandidate(sponsor, event, semantic, maxFootfall = event.expectedFootfall) {
  const cheapestPrice = Math.min(...(event.tiers ?? []).map((tier) => tier.price));
  if (!Number.isFinite(cheapestPrice)) return null;

  const budgetMax = Number(sponsor.budgetMax);
  if (Number.isFinite(budgetMax) && cheapestPrice > budgetMax) return null;

  const budgetMin = Number(sponsor.budgetMin);
  const lowerBudget = Number.isFinite(budgetMin) ? Math.max(0, budgetMin * 0.5) : 0;
  let budgetFit = 1;
  if (cheapestPrice < lowerBudget && lowerBudget > 0) {
    budgetFit = cheapestPrice / lowerBudget;
  } else if (Number.isFinite(budgetMax) && cheapestPrice > budgetMax) {
    budgetFit = budgetMax > 0
      ? 1 - ((cheapestPrice - budgetMax) / (budgetMax * 0.5))
      : 0;
  }

  const sponsorCity = sponsor.city?.trim().toLowerCase();
  const eventCity = event.city?.trim().toLowerCase();
  const cityMatch = sponsorCity && eventCity && sponsorCity === eventCity ? 1 : 0;
  const footfall = maxFootfall > 0
    ? normalize((event.expectedFootfall ?? 0) / maxFootfall)
    : 0;
  const score = (
    0.6 * normalize(semantic ?? 0.5)
    + 0.2 * normalize(budgetFit)
    + 0.1 * cityMatch
    + 0.1 * footfall
  );
  return Math.round(score * 100);
}

export function clearMatchCache(sponsorId) {
  if (sponsorId) matchCache.delete(sponsorId.toString());
}

function cheapestPrice(event) {
  if (!event.tiers?.length) return null;
  return Math.min(...event.tiers.map((tier) => tier.price));
}

function templateReason(sponsor, event) {
  const subject = event.category ? `This ${event.category} event` : 'This event';
  const location = event.city ? ` in ${event.city}` : '';
  const focus = sponsor.industry ? ` aligns with your ${sponsor.industry} focus` : ' may fit your sponsorship goals';
  return `${subject}${location}${focus}.`;
}

function cleanReason(reason, sponsor, event) {
  const sentence = reason.trim().split(/(?<=[.!?])\s+/)[0] ?? '';
  const words = sentence.split(/\s+/).filter(Boolean);
  if (!words.length) return templateReason(sponsor, event);
  if (words.length < 25) return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
  return `${words.slice(0, 24).join(' ').replace(/[.!?]+$/, '')}.`;
}

async function generateReasons(sponsor, matches) {
  const sponsorFacts = {
    industry: sponsor.industry ?? '',
    goals: sponsor.goals ?? '',
    audience: sponsor.targetAudience ?? '',
    city: sponsor.city ?? '',
  };
  const eventFacts = matches.map(({ event }) => ({
    eventId: event._id.toString(),
    title: event.title,
    category: event.category,
    city: event.city,
    audienceProfile: event.audienceProfile,
    footfall: event.expectedFootfall,
    cheapestPrice: cheapestPrice(event),
  }));
  let reasonsById = new Map();

  if (matches.length) {
    try {
      const result = await chatJSON({
        schema: reasonSchema,
        maxTokens: 500,
        messages: [
          {
            role: 'system',
            content: [
              'Write exactly one concise sentence under 25 words for each event explaining its relevance to the sponsor.',
              'Use only the supplied facts. Do not invent numbers or facts.',
              'Return JSON with a reasons array of { eventId, reason } objects.',
            ].join(' '),
          },
          { role: 'user', content: JSON.stringify({ sponsor: sponsorFacts, events: eventFacts }) },
        ],
      });
      reasonsById = new Map(result.reasons.map((item) => [item.eventId, item.reason]));
    } catch (error) {
      console.error('Could not generate match reasons:', error);
    }
  }

  return matches.map(({ event, score }) => ({
    event,
    score,
    reason: cleanReason(reasonsById.get(event._id.toString()) ?? '', sponsor, event),
  }));
}

async function calculateMatches(sponsor) {
  let candidates = [];
  let usedFallback = false;
  let sponsorRecord = await User.findById(sponsor._id).select('+embedding');
  if (!sponsorRecord || sponsorRecord.role !== 'sponsor') {
    return { matches: [], usedFallback: true };
  }

  if (!sponsorRecord.embedding?.length) {
    const embedded = await embedSponsor(sponsorRecord._id);
    if (embedded) {
      sponsorRecord = await User.findById(sponsorRecord._id).select('+embedding');
    }
    if (!embedded || !sponsorRecord?.embedding?.length) {
      usedFallback = true;
    }
  }

  if (!usedFallback) {
    try {
      candidates = await candidateProvider.vectorCandidates(sponsorRecord.embedding, 20);
      if (candidates.length < 3) usedFallback = true;
    } catch (error) {
      console.error('Vector search unavailable; using fallback matches:', error);
      usedFallback = true;
    }
  }

  if (usedFallback) candidates = await candidateProvider.fallbackCandidates(sponsorRecord);

  const activeEventIds = await Proposal.distinct('event', {
    sponsor: sponsorRecord._id,
    status: { $in: ['pending', 'countered', 'accepted'] },
  });
  const excludedIds = new Set(activeEventIds.map((id) => id.toString()));
  const available = candidates.filter((event) => !excludedIds.has(event._id.toString()));
  const eligible = available.filter((event) => {
    const price = cheapestPrice(event);
    return price !== null && (
      !Number.isFinite(Number(sponsorRecord.budgetMax))
      || price <= Number(sponsorRecord.budgetMax)
    );
  });
  const maxFootfall = Math.max(0, ...eligible.map((event) => event.expectedFootfall ?? 0));
  const ranked = eligible
    .map((event) => ({
      event,
      score: scoreCandidate(sponsorRecord, event, event.semantic, maxFootfall),
    }))
    .filter((match) => match.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    matches: await generateReasons(sponsorRecord, ranked),
    usedFallback,
  };
}

export async function getMatches(sponsor) {
  const key = sponsor._id.toString();
  const cached = matchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = await calculateMatches(sponsor);
  matchCache.set(key, { value, expiresAt: Date.now() + cacheTtlMs });
  return value;
}
