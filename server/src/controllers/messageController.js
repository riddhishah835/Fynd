import {
  createMessage,
  listMessages,
} from '../services/messageService.js';

export async function list(req, res, next) {
  try {
    const messages = await listMessages(req.user, req.params.id, req.query);
    res.json({ messages });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const message = await createMessage(req.user, req.params.id, req.body.text);
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
}
