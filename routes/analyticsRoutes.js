const express = require("express");
const router = express.Router();
const AnalyticsController = require("../controllers/analyticsController");
const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

router.get(
  "/dashboard",
  authenticateToken,
  AnalyticsController.getDashboardStats
);
router.post(
  "/create/snapshots",
  authenticateToken,
  requireAdmin,
  AnalyticsController.createAnalyticsSnapshot
);
router.get(
  "/snapshots",
  authenticateToken,
  requireAdmin,
  AnalyticsController.getAnalyticsSnapshots
);

module.exports = router;
