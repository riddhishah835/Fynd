import {
  attachProof,
  listDeliverables,
  updateDeliverable,
} from '../services/deliverableService.js';

export async function listForProposal(req, res, next) {
  try {
    const deliverables = await listDeliverables(req.user, req.params.id);
    res.json({ deliverables });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const deliverable = await updateDeliverable(req.user, req.params.id, req.body);
    res.json({ deliverable });
  } catch (error) {
    next(error);
  }
}

export async function uploadProof(req, res, next) {
  try {
    const deliverable = await attachProof(req.user, req.params.id, req.file);
    res.json({ deliverable });
  } catch (error) {
    next(error);
  }
}
