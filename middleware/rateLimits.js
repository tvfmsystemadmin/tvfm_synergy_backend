import rateLimit from 'express-rate-limit';

const json = (error) => ({ ok: false, error });

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many login attempts. Please try again in 15 minutes.'),
});

// Password reset: codes can be asked for and tried only a limited number of times from one address.
export const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json("Too many attempts. Please try again in 15 minutes."),
});

export const enquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many requests. Please try again in a few minutes, or call us.'),
});

// Visit tracking: one browser pings about twice a minute. A whole office behind one address gets a generous limit.
export const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many visits recorded from this network.'),
});
