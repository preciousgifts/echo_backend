import express from "express";
const router = express.Router();
import AnalyticsController from "../controllers/analyticsController.js";
import { authenticateToken, requireAdmin, } from "../middleware/authMiddleware.js";

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

export default router;
