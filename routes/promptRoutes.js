import express from "express";
const router = express.Router();
import PromptController from "../controllers/promptController.js";
import { authenticateToken, requireAdmin, } from "../middleware/authMiddleware.js";
import { validate, promptCreateSchema, } from "../middleware/validationMiddleware.js";

router.post(
  "/create",
  authenticateToken,
  validate(promptCreateSchema),
  PromptController.createPrompt,
);
// router.post("/create", authenticateToken, requireAdmin, validate(promptCreateSchema), PromptController.createPrompt);
router.post("/get-prompts", authenticateToken, PromptController.getPrompts);
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  PromptController.listAllPrompts,
);
router.get("/random", authenticateToken, PromptController.getRandomPrompt);
router.put(
  "/:promptId",
  authenticateToken,
  requireAdmin,
  PromptController.updatePrompt,
);
router.delete(
  "/:promptId",
  authenticateToken,
  requireAdmin,
  PromptController.deletePrompt,
);

export default router;
