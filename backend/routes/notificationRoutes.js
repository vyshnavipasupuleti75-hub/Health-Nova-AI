import { Router } from 'express';
import auth from '../middleware/auth.js';
import { getNotificationConfig, sendTestNotification, subscribe, unsubscribe } from '../controllers/notificationController.js';

// Bearer-token authenticated (no cookies), so these endpoints cannot be triggered by cross-site form posts.
const router = Router();
router.use(auth);
router.get('/config', getNotificationConfig);
router.post('/subscription', subscribe);
router.delete('/subscription', unsubscribe);
router.post('/test', sendTestNotification);
export default router;
