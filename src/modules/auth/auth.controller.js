import { z } from 'zod';
import {
  createUser,
  findUserByEmail,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  findUserById,
  isUsernameTaken
} from './auth.service.js';
import { env } from '../../config/env.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Минимум 8 символов'),
  name: z.string().min(2).max(100),
  username: z.string()
    .min(3, 'Минимум 3 символа')
    .max(20, 'Максимум 20 символов')
    .regex(/^[a-zA-Z0-9_]+$/, 'Только латиница, цифры и _'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

export const register = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await findUserByEmail(data.email);
    if (existing) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }
    if (await isUsernameTaken(data.username)) {
      return res.status(409).json({ message: 'Этот юзернейм уже занят' });
    }

    let user;
    try {
      user = await createUser(data);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ message: 'Этот юзернейм уже занят' });
      }
      throw err;
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await findUserByEmail(data.email);

    if (!user || !(await comparePassword(data.password, user.password_hash))) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({
      user: { id: user.id, email: user.email, name: user.name, username: user.username, avatar_url: user.avatar_url },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const rawToken = req.cookies.refreshToken;
    if (!rawToken) return res.status(401).json({ message: 'Нет refresh-токена' });

    const stored = await verifyRefreshToken(rawToken);
    if (!stored) return res.status(401).json({ message: 'Токен недействителен' });

    await revokeRefreshToken(rawToken);
    const newRefreshToken = await generateRefreshToken(stored.user_id);
    const accessToken = generateAccessToken(stored.user_id);

    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const rawToken = req.cookies.refreshToken;
    if (rawToken) await revokeRefreshToken(rawToken);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    const user = await findUserById(req.userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
};