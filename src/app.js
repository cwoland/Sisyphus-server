import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import exercisesRoutes from './modules/exercise/exercise.routes.js';
import programRoutes from './modules/programs/programs.routes.js';
import workoutsRoutes from './modules/workouts/workouts.routes.js';
import nutritionRoutes from './modules/nutrition/nutrition.routes.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/workouts', workoutsRoutes);
app.use('/api/nutrition', nutritionRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorMiddleware);

export default app;