const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, requireAdmin, UserController.getAllUsers);
router.get('/:userId', authenticateToken, UserController.getUserById);
router.put('/:userId', authenticateToken, requireAdmin, UserController.updateUser);
router.post('/:userId/deactivate', authenticateToken, requireAdmin, UserController.deactivateUser);
router.post('/:userId/reactivate', authenticateToken, requireAdmin, UserController.reactivateUser);
router.get('/:userId/stats', authenticateToken, UserController.getUserStats);
router.get('/:userId/recordings', authenticateToken, UserController.getUserRecordings);
router.post('/create-validator', authenticateToken,requireAdmin, UserController.createValidatorAccount);

module.exports = router;