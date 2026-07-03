import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import {
    getMyPrograms,
    getProgram,
    postProgram,
    removeProgram,
    postForkProgram,
} from './programs.controller.js';

const router = Router();

router.use(authGuard);

router.get('/', getMyPrograms);
router.get('/:id', getProgram);
router.post('/', postProgram);
router.delete('/:id', removeProgram);
router.post('/:id/fork', postForkProgram);

export default router;