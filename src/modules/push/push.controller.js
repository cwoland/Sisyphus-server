import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { saveSubscription, removeSubscription } from './push.service.js';
import { sendTodayReminders } from './reminders.service.js';
import { env } from '../../config/env.js';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export const getPublicKey = asyncHandler(async (req, res) => {
  res.json({ publicKey: env.vapidPublicKey });
});

export const postSubscribe = asyncHandler(async (req, res) => {
  const data = subscriptionSchema.parse(req.body);
  const subscription = await saveSubscription(req.userId, data);
  res.status(201).json({ subscription });
});

export const postUnsubscribe = asyncHandler(async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
  await removeSubscription(req.userId, endpoint);
  res.status(204).send();
});

export const triggerReminders = asyncHandler(async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== env.cronSecret) {
    return res.status(401).json({ message: 'Unauthorized' });
  } 

  const result = await sendTodayReminders();
  res.json({ ok: true, ...result });
});