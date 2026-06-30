import express from 'express';
const router = express.Router();
import MicropaymentController from '../controllers/micropaymentController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

router.post('/', authenticateToken, requireAdmin, MicropaymentController.createPayment);
router.get('/', authenticateToken, requireAdmin, MicropaymentController.getAllPayments);
router.get('/me', authenticateToken, MicropaymentController.getMyPayments);
router.get('/:paymentId', authenticateToken, MicropaymentController.getPaymentById);
router.patch('/:paymentId/status', authenticateToken, requireAdmin, MicropaymentController.updatePaymentStatus);

export default router;
