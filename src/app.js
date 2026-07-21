import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

import authRoutes from './modules/auth/auth.routes.js';
import exercisesRoutes from './modules/exercises/exercises.routes.js';
import programsRoutes from './modules/programs/programs.routes.js';
import workoutsRoutes from './modules/workouts/workouts.routes.js';
import nutritionRoutes from './modules/nutrition/nutrition.routes.js';
import friendsRoutes from './modules/friends/friends.routes.js';
import sharesRoutes from './modules/shares/shares.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';
import pushRoutes from './modules/push/push.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/programs', programsRoutes);
app.use('/api/workouts', workoutsRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/shares', sharesRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorMiddleware);

export default app;