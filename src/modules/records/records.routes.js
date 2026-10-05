import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getRecords, getHistory } from './records.controller.js';

const router = Router();
router.use(authGuard);
router.get('/', getRecords);
router.get('/history/:exerciseId', getHistory);
export default router;
