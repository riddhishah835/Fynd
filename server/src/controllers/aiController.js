import {
  draftProposal,
  extractEvent,
} from '../services/aiService.js';

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
