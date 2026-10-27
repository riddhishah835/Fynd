import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import User from '../models/User.js';
import { assertParticipant } from '../services/messageService.js';

let io;

export function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const { token } = socket.handshake.auth ?? {};
      const payload = jwt.verify(token, config.jwtSecret);
      if (payload.purpose !== 'socket' || !payload.sub) {
        next(new Error('UNAUTHENTICATED'));
        return;
      }

      const user = await User.findById(payload.sub).select('-passwordHash');
      if (!user) {
        next(new Error('UNAUTHENTICATED'));
        return;
      }

      socket.data.user = user;
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('proposal:join', async (proposalId, ack) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(proposalId)) {
          throw new Error('Invalid proposal id');
        }
        await assertParticipant(socket.data.user, proposalId);
        await socket.join(`proposal:${proposalId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch {
        if (typeof ack === 'function') ack({ ok: false, error: 'Not found' });
      }
    });

    socket.on('proposal:leave', (proposalId) => {
      if (mongoose.Types.ObjectId.isValid(proposalId)) {
        socket.leave(`proposal:${proposalId}`);
      }
    });
  });

  return io;
}

export function emitToProposal(proposalId, event, payload) {
  io?.to(`proposal:${proposalId}`).emit(event, payload);
}
