import {
  createProposal,
  getProposalForUser,
  listProposalsForUser,
  transitionProposal,
} from '../services/proposalService.js';

export async function create(req, res, next) {
  try {
    const proposal = await createProposal(req.user, req.body);
    res.status(201).json({ proposal });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const proposals = await listProposalsForUser(req.user, req.query.status);
    res.json({ proposals });
  } catch (error) {
    next(error);
  }
}

export async function get(req, res, next) {
  try {
    const proposal = await getProposalForUser(req.user, req.params.id);
    res.json({ proposal });
  } catch (error) {
    next(error);
  }
}

export async function transition(req, res, next) {
  try {
    const proposal = await transitionProposal({
      proposalId: req.params.id,
      actor: req.user,
      toStatus: req.body.toStatus,
      payload: req.body,
    });
    res.json({ proposal });
  } catch (error) {
    next(error);
  }
}
