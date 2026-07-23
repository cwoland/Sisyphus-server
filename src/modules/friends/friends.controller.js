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
  username: z.string().min(1),
});

export const getUserSearch = asyncHandler(async (req, res) => {
  const users = await searchUsersByUsername(req.userId, req.query.q);
  res.json({ users });
});

export const postFriendRequest = asyncHandler(async (req, res) => {
  const { username } = sendRequestSchema.parse(req.body);
  const friendship = await sendFriendRequest(req.userId, username);
  res.status(201).json({ friendship });
});

const respondSchema = z.object({
  accept: z.boolean(),
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