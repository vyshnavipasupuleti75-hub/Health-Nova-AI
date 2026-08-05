import {Router} from 'express';import auth from '../middleware/auth.js';import {chat} from '../controllers/chatController.js';const router=Router();router.post('/',auth,chat);export default router;
