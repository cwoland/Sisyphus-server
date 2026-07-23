import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import {
    getMyPrograms,
    getProgram,
    postProgram,
    putProgram,
    removeProgram,
    postForkProgram,
    getPublicPrograms,
} from './programs.controller.js';

const router = Router();

router.use(authGuard);

router.get('/', getMyPrograms);
router.get('/public', getPublicPrograms);
router.get('/:id', getProgram);
router.post('/', postProgram);
router.put('/:id', putProgram);
router.delete('/:id', removeProgram);
router.post('/:id/fork', postForkProgram);

export default router;