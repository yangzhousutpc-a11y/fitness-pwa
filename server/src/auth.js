export function requireApiToken(apiToken) {
  return (req, res, next) => {
    if (!apiToken) {
      res.status(500).json({ code: 1, message: 'API_TOKEN is not configured' });
      return;
    }

    const expected = `Bearer ${apiToken}`;
    if (req.get('authorization') !== expected) {
      res.status(401).json({ code: 1, message: 'Unauthorized' });
      return;
    }

    next();
  };
}
