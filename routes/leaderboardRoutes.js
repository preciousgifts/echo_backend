import express from 'express';
const router = express.Router();
import LeaderboardController from '../controllers/leaderboardController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

router.get('/', authenticateToken, LeaderboardController.getLeaderboard);

export default router;
