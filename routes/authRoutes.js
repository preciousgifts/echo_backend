import express from "express";
const router = express.Router();
import AuthController from "../controllers/authController.js";
import { validate, userRegistrationSchema, userLoginSchema, } from "../middleware/validationMiddleware.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

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

export default router;
