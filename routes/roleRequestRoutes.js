import express from 'express';
const router = express.Router();
import RoleRequestController from '../controllers/roleRequestController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

router.post('/', authenticateToken, RoleRequestController.createRequest);
router.get('/mine', authenticateToken, RoleRequestController.getMyRequests);
router.get('/', authenticateToken, requireAdmin, RoleRequestController.getAllRequests);
router.put('/:requestId/review', authenticateToken, requireAdmin, RoleRequestController.reviewRequest);

export default router;
