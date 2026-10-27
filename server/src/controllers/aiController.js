import {
  draftProposal,
  extractEvent,
} from '../services/aiService.js';
import { getMatches } from '../services/matchService.js';

export async function draft(req, res, next) {
  try {
    const result = await draftProposal(req.user, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function extract(req, res, next) {
  try {
    const result = await extractEvent(req.body.text);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function matches(req, res, next) {
  try {
    res.json(await getMatches(req.user));
  } catch (error) {
    next(error);
  }
}
