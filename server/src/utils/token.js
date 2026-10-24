import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

function authCookieOptions() {
  const production = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    maxAge: sevenDaysMs,
    sameSite: production ? 'none' : 'lax',
    secure: production,
    path: '/',
  };
}

export function signToken(userId, role) {
  return jwt.sign({ userId: userId.toString(), role }, config.jwtSecret, {
    expiresIn: '7d',
  });
}

export function setAuthCookie(res, token) {
  res.cookie('token', token, authCookieOptions());
}

export function clearAuthCookie(res) {
  const { maxAge, ...options } = authCookieOptions();
  res.clearCookie('token', options);
}
