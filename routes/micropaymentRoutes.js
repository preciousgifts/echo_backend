const express = require('express');
const router = express.Router();
const MicropaymentController = require('../controllers/micropaymentController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

router.post('/', authenticateToken, requireAdmin, MicropaymentController.createPayment);
router.get('/', authenticateToken, requireAdmin, MicropaymentController.getAllPayments);
router.get('/me', authenticateToken, MicropaymentController.getMyPayments);
router.get('/:paymentId', authenticateToken, MicropaymentController.getPaymentById);
router.patch('/:paymentId/status', authenticateToken, requireAdmin, MicropaymentController.updatePaymentStatus);

module.exports = router;
