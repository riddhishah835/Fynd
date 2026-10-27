import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user._id.toString(),
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

export default aiRateLimit;
