import Event from '../models/Event.js';
import User from '../models/User.js';
import { embed } from './llm.js';

export function eventText(event) {
  const tierNames = (event.tiers ?? [])
    .map((tier) => `${tier.name} (${tier.price})`)
    .join(', ');
  return [
    `Title: ${event.title ?? ''}`,
    `Category: ${event.category ?? ''}`,
    `City: ${event.city ?? ''}`,
    `Description: ${(event.description ?? '').slice(0, 600)}`,
    `Audience: ${event.audienceProfile ?? ''}`,
    `Expected footfall: ${event.expectedFootfall ?? ''}`,
    `Sponsorship tiers: ${tierNames}`,
  ].join('\n');
}

export function sponsorText(user) {
  const budget = user.budgetMin != null || user.budgetMax != null
    ? `${user.budgetMin ?? 'unspecified'}-${user.budgetMax ?? 'unspecified'}`
    : '';
  return [
    `Industry: ${user.industry ?? ''}`,
    `Target audience: ${user.targetAudience ?? ''}`,
    `Goals: ${user.goals ?? ''}`,
    `City: ${user.city ?? ''}`,
    `Organization: ${user.organization ?? ''}`,
    `Budget range: ${budget}`,
  ].join('\n');
}

export async function embedEvent(eventId) {
  try {
    const event = await Event.findById(eventId);
    if (!event) throw new Error(`Event ${eventId} was not found for embedding`);
    event.embedding = await embed(eventText(event), 'RETRIEVAL_DOCUMENT');
    await event.save();
    return true;
  } catch (error) {
    console.error('Could not generate event embedding:', error);
    return false;
  }
}

export async function embedSponsor(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || user.role !== 'sponsor') {
      throw new Error(`Sponsor ${userId} was not found for embedding`);
    }
    user.embedding = await embed(sponsorText(user), 'RETRIEVAL_QUERY');
    await user.save();
    return true;
  } catch (error) {
    console.error('Could not generate sponsor embedding:', error);
    return false;
  }
}
