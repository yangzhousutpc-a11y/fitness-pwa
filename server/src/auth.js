import { timingSafeEqual } from 'node:crypto';

export function parseApiTokens(rawApiToken) {
  if (!rawApiToken) {
    return [];
  }
  return String(rawApiToken)
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function safeEqual(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

export function requireApiToken(rawApiToken) {
  const tokens = parseApiTokens(rawApiToken);

  return (req, res, next) => {
    if (tokens.length === 0) {
      res.status(500).json({ code: 1, message: 'API_TOKEN is not configured' });
      return;
    }

    const header = req.get('authorization') || '';
    const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!presented || !tokens.some((token) => safeEqual(presented, token))) {
      res.status(401).json({ code: 1, message: 'Unauthorized' });
      return;
    }

    next();
  };
}
