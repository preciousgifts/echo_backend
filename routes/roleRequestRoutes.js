const express = require('express');
const router = express.Router();
const RoleRequestController = require('../controllers/roleRequestController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

router.post('/', authenticateToken, RoleRequestController.createRequest);
router.get('/mine', authenticateToken, RoleRequestController.getMyRequests);
router.get('/', authenticateToken, requireAdmin, RoleRequestController.getAllRequests);
router.put('/:requestId/review', authenticateToken, requireAdmin, RoleRequestController.reviewRequest);

module.exports = router;
