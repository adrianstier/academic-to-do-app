import { Request, Response, NextFunction } from 'express';

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.API_KEY;

  // If no API key is configured, allow all requests
  if (!apiKey || apiKey === 'your-secret-api-key') {
    next();
    return;
  }

  const providedKey = req.headers['x-api-key'];

  if (!providedKey || providedKey !== apiKey) {
    res.status(401).json({ error: 'Invalid or missing API key' });
    return;
  }

  next();
}
