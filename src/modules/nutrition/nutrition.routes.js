import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import {
  getEntries,
  postEntry,
  patchEntry,
  removeEntry,
  getSummary,
  getTargets,
  putTargets,
  getRecentFoods,
} from './nutrition.controller.js';

const router = Router();

router.use(authGuard);
router.get('/entries', getEntries);
router.get('recent', getRecentFoods);
router.post('/entries', postEntry);
router.patch('/entries/:id', patchEntry);
router.delete('/entries/:id', removeEntry);
router.get('/summary', getSummary);
router.get('/targets', getTargets);
router.put('/targets', putTargets);

export default router;