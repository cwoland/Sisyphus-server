import { ZodError } from 'zod';

export const errorMiddleware = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Ошибка валидации', errors: err.errors });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Внутренняя ошибка сервера' });
};