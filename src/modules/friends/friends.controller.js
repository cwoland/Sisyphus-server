import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  sendFriendRequest,
  respondToFriendRequest,
  listFriends,
  listPendingRequests,
  removeFriend,
} from './friends.service.js';

const sendRequestSchema = z.object({
  email: z.string().email(),
});

const respondSchema = z.object({
  accept: z.boolean(),
});

export const postFriendRequest = asyncHandler(async (req, res) => {
  const { email } = sendRequestSchema.parse(req.body);
  const friendship = await sendFriendRequest(req.userId, email);
  res.status(201).json({ friendship });
});

export const patchFriendRequest = asyncHandler(async (req, res) => {
  const { accept } = respondSchema.parse(req.body);
  const result = await respondToFriendRequest(req.params.id, req.userId, accept);
  res.json({ result });
});

export const getFriends = asyncHandler(async (req, res) => {
  const friends = await listFriends(req.userId);
  res.json({ friends });
});

export const getPendingRequests = asyncHandler(async (req, res) => {
  const requests = await listPendingRequests(req.userId);
  res.json({ requests });
});

export const deleteFriend = asyncHandler(async (req, res) => {
  await removeFriend(req.params.id, req.userId);
  res.status(204).send();
});