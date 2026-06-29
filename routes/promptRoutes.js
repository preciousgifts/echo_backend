const express = require("express");
const router = express.Router();
const PromptController = require("../controllers/promptController");
const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/authMiddleware");
const {
  validate,
  promptCreateSchema,
} = require("../middleware/validationMiddleware");

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

module.exports = router;
