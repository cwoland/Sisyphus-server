import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { patchMe, patchPassword } from './users.controller.js';

const router = Router();
router.use(authGuard);
router.patch('/me', patchMe);
router.patch('/me/password', patchPassword);

export default router;