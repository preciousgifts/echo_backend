const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/authController");
const {
  validate,
  userRegistrationSchema,
  userLoginSchema,
} = require("../middleware/validationMiddleware");
const { authenticateToken } = require("../middleware/authMiddleware");

router.post(
  "/register",
  validate(userRegistrationSchema),
  AuthController.register
);
router.post("/login", validate(userLoginSchema), AuthController.login);
router.get("/profile", authenticateToken, AuthController.getProfile);
router.put("/profile", authenticateToken, AuthController.updateProfile);
router.post(
  "/change-password",
  authenticateToken,
  AuthController.changePassword
);
router.post("/request-otp", AuthController.requestPasswordOtp);
router.post("/verify-otp", AuthController.validateOtp);
router.post("/reset-password", AuthController.resetPassword);
router.delete("/account", authenticateToken, AuthController.deleteAccount);
router.post("/registration-otp", AuthController.sendRegistrationOtp);
router.post("/verify-registration-otp", AuthController.validateRegistrationOtp);

module.exports = router;
