import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import {
  clearAuthCookie,
  setAuthCookie,
  signSocketToken,
  signToken,
} from '../utils/token.js';
import { embedSponsor } from '../services/embeddingService.js';
import { clearMatchCache } from '../services/matchService.js';

const duplicateEmailError = () =>
  new AppError('CONFLICT', 'An account with this email already exists');

export async function signup(req, res, next) {
  try {
    const { password, ...userData } = req.body;
    const email = userData.email.toLowerCase();

    if (await User.exists({ email })) {
      throw duplicateEmailError();
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ ...userData, email, passwordHash });
    if (user.role === 'sponsor') {
      void embedSponsor(user._id);
    }
    const token = signToken(user._id, user.role);

    setAuthCookie(res, token);
    res.status(201).json({ user });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      next(duplicateEmailError());
      return;
    }
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() })
      .select('+passwordHash');
    const passwordMatches = user
      ? await bcrypt.compare(req.body.password, user.passwordHash)
      : false;

    if (!passwordMatches) {
      throw new AppError('UNAUTHENTICATED', 'Invalid email or password');
    }

    const token = signToken(user._id, user.role);
    user.passwordHash = undefined;
    setAuthCookie(res, token);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export function logout(req, res) {
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
}

export function getMe(req, res) {
  res.json({ user: req.user });
}

export function getSocketToken(req, res) {
  res.json({ token: signSocketToken(req.user._id) });
}

export async function updateProfile(req, res, next) {
  try {
    const sharedFields = ['name', 'organization', 'city', 'bio', 'website'];
    const roleFields = req.user.role === 'sponsor'
      ? ['industry', 'targetAudience', 'budgetMin', 'budgetMax', 'goals']
      : ['orgType'];
    const allowedFields = [...sharedFields, ...roleFields];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([field]) => allowedFields.includes(field)),
    );

    Object.assign(req.user, updates);
    await req.user.save();

    if (req.user.role === 'sponsor') {
      clearMatchCache(req.user._id);
      void embedSponsor(req.user._id);
    }
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
}
