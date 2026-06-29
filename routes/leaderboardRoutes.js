const express = require('express');
const router = express.Router();
const LeaderboardController = require('../controllers/leaderboardController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, LeaderboardController.getLeaderboard);

module.exports = router;
