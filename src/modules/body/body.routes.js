import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getMetrics, getLatest, postMetric, removeMetric } from './body.controller.js';

const router = Router();
router.use(authGuard);
router.get('/', getMetrics);
router.get('/latest', getLatest);
router.post('/', postMetric);
router.delete('/:id', removeMetric);

export default router;