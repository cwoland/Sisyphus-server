import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getFoodSearch, getFoodProduct, getFoodPicker } from './food.controller.js';

const router = Router();
router.use(authGuard);
router.get('/search', getFoodSearch);
router.get('/picker', getFoodPicker);
router.get('/:barcode', getFoodProduct);

export default router;
