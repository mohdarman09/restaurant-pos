import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listNotifications, markRead, markAllRead } from '../controllers/notification.controller';

const router = Router();
router.use(authenticate);

router.get('/', listNotifications);
router.patch('/:id/read', markRead);
router.patch('/read-all', markAllRead);

export default router;
