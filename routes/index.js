const express = require("express");
const router = express.Router();

// Import route files
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const recordingRoutes = require("./recordingRoutes");
const validationRoutes = require("./validationRoutes");
const promptRoutes = require("./promptRoutes");
const analyticsRoutes = require("./analyticsRoutes");
const dialectRoutes = require("./dialectRoutes");
const languageRoutes = require("./languageRoutes");
const micropaymentRoutes = require("./micropaymentRoutes");
const leaderboardRoutes = require("./leaderboardRoutes");
const roleRequestRoutes = require("./roleRequestRoutes");
const countriesRoutes = require("./countriesRoutes");

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

module.exports = router;
