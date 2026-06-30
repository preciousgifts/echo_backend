import express from 'express';
const router = express.Router();
import UserController from '../controllers/userController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

router.get('/', authenticateToken, requireAdmin, UserController.getAllUsers);
router.get('/:userId', authenticateToken, UserController.getUserById);
router.put('/:userId', authenticateToken, requireAdmin, UserController.updateUser);
router.post('/:userId/deactivate', authenticateToken, requireAdmin, UserController.deactivateUser);
router.post('/:userId/reactivate', authenticateToken, requireAdmin, UserController.reactivateUser);
router.get('/:userId/stats', authenticateToken, UserController.getUserStats);
router.get('/:userId/recordings', authenticateToken, UserController.getUserRecordings);
router.post('/create-validator', authenticateToken,requireAdmin, UserController.createValidatorAccount);

export default router;