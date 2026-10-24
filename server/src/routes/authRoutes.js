import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import {
  getMe,
  login,
  logout,
  signup,
  updateProfile,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  loginSchema,
  signupSchema,
  updateProfileSchema,
} from '../validators/authValidators.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => config.nodeEnv === 'test',
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
        details: [],
      },
    });
  },
});

router.post('/signup', authLimiter, validate(signupSchema), signup);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, validate(updateProfileSchema), updateProfile);

export default router;
