import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { updateProfile, changePassword } from './users.service.js';
import { isUsernameTaken, generateRefreshToken } from '../auth/auth.service.js';
import { REFRESH_COOKIE_OPTIONS } from '../auth/auth.controller.js';

const profileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Только латиница, цифры и _').optional(),
  avatarUrl: z.string().max(255).nullable().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Минимум 8 символов'),
});

export const patchMe = asyncHandler(async (req, res) => {
  const data = profileSchema.parse(req.body);

  if (data.username && await isUsernameTaken(data.username, req.userId)) {
    return res.status(409).json({ message: 'Этот юзернейм уже занят' });
  }

  try {
    const user = await updateProfile(req.userId, data);
    res.json({ user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Этот юзернейм уже занят' });
    }
    throw err;
  }
});

export const patchPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = passwordSchema.parse(req.body);
  await changePassword(req.userId, currentPassword, newPassword);
  
  const refreshToken = await generateRefreshToken(req.userId);
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  res.status(204).send();
});