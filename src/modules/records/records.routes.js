import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getRecords } from './records.controller.js';

const router = Router();
router.use(authGuard);
router.get('/', getRecords);
export default router;