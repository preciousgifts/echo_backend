import express from "express";
const router = express.Router();

// Import route files
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import recordingRoutes from "./recordingRoutes.js";
import validationRoutes from "./validationRoutes.js";
import promptRoutes from "./promptRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
import dialectRoutes from "./dialectRoutes.js";
import languageRoutes from "./languageRoutes.js";
import micropaymentRoutes from "./micropaymentRoutes.js";
import leaderboardRoutes from "./leaderboardRoutes.js";
import roleRequestRoutes from "./roleRequestRoutes.js";
import countriesRoutes from "./countriesRoutes.js";

// Use routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/recordings", recordingRoutes);
router.use("/validations", validationRoutes);
router.use("/prompts", promptRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/dialects", dialectRoutes);
router.use("/languages", languageRoutes);
router.use("/payments", micropaymentRoutes);
router.use("/leaderboard", leaderboardRoutes);
router.use("/role-requests", roleRequestRoutes);
router.use("/countries", countriesRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date(),
  });
});

export default router;
