import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getFoodSearch, getFoodProduct } from './food.controller.js';

const router = Router();
router.use(authGuard);
router.get('/search', getFoodSearch);
router.get('/:barcode', getFoodProduct);

export default router;
