import express from "express";
const router = express.Router();
import LanguageController from "../controllers/languageController.js";
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";

router.get("/", LanguageController.getAllLanguages);
router.post("/", authenticateToken, requireAdmin, LanguageController.addLanguage);
router.put("/:languageId", authenticateToken, requireAdmin, LanguageController.updateLanguage);
router.delete("/:languageId", authenticateToken, requireAdmin, LanguageController.deleteLanguage);

export default router;
