import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getOrCreateChat,
  listUserChats,
  listMessages,
  sendMessage,
  markMessagesRead,
} from './chat.service.js';

const startChatSchema = z.object({
  friendId: z.string().uuid(),
});

const sendMessageSchema = z.object({
  text: z.string().min(1).max(2000),
});

export const postStartChat = asyncHandler(async (req, res) => {
  const { friendId } = startChatSchema.parse(req.body);
  const chat = await getOrCreateChat(req.userId, friendId);
  res.status(201).json({ chat });
});

export const getChats = asyncHandler(async (req, res) => {
  const chats = await listUserChats(req.userId);
  res.json({ chats });
});

export const getMessages = asyncHandler(async (req, res) => {
  const { after, limit } = req.query;
  const messages = await listMessages(req.params.chatId, req.userId, {
    after,
    limit: limit ? parseInt(limit, 10) : undefined,
  });
  res.json({ messages });
});

export const postMessage = asyncHandler(async (req, res) => {
  const { text } = sendMessageSchema.parse(req.body);
  const message = await sendMessage(req.params.chatId, req.userId, text);
  res.status(201).json({ message });
});

export const patchMessagesRead = asyncHandler(async (req, res) => {
  await markMessagesRead(req.params.chatId, req.userId);
  res.status(204).send();
});