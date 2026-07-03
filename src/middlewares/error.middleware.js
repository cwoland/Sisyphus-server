import { ZodError } from 'zod';
import { apiError } from '../utils/apiError.js';

export const errorMiddleware = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Ошибка валидации', errors: err.errors });
  }
  if (err instanceof apiError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Внутренняя ошибка сервера' });
};