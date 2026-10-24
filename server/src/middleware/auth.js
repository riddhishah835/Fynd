import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';
import AppError from '../utils/AppError.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    next(new AppError('UNAUTHENTICATED', 'Authentication required'));
    return;
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    next(new AppError('UNAUTHENTICATED', 'Authentication required'));
    return;
  }

  try {
    const user = await User.findById(payload.userId).select('-passwordHash');
    if (!user) {
      next(new AppError('UNAUTHENTICATED', 'Authentication required'));
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('FORBIDDEN', 'You do not have permission to do this'));
      return;
    }

    next();
  };
}
