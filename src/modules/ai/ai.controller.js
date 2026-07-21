import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createConversation,
  listConversations,
  getConversationMessages,
  sendMessageToAI,
  deleteConversation,
} from './ai.service.js';

const createConversationSchema = z.object({
  contextType: z.enum(['free', 'program', 'workout', 'nutrition']).optional(),
  contextId: z.string().uuid().optional(),
  title: z.string().max(150).optional(),
});

const sendMessageSchema = z.object({
  message: z.string().min(1).max(4000),
});

export const postConversation = asyncHandler(async (req, res) => {
  const data = createConversationSchema.parse(req.body);
  const conversation = await createConversation(req.userId, data);
  res.status(201).json({ conversation });
});

export const getConversations = asyncHandler(async (req, res) => {
  const conversations = await listConversations(req.userId);
  res.json({ conversations });
});

export const getMessages = asyncHandler(async (req, res) => {
  const data = await getConversationMessages(req.params.id, req.userId);
  res.json(data);
});

export const postMessage = asyncHandler(async (req, res) => {
  const { message } = sendMessageSchema.parse(req.body);
  const aiMessage = await sendMessageToAI(req.params.id, req.userId, message);
  res.status(201).json({ message: aiMessage });
});

export const removeConversation = asyncHandler(async (req, res) => {
  await deleteConversation(req.params.id, req.userId);
  res.status(204).send();
});