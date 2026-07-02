import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const authGuard = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ message: 'Требуется авторизация' });

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: 'Токен истёк или недействителен' });
  }
};