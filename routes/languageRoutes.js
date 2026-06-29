const express = require("express");
const router = express.Router();
const LanguageController = require("../controllers/languageController");
const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware");

router.get("/", LanguageController.getAllLanguages);
router.post("/", authenticateToken, requireAdmin, LanguageController.addLanguage);
router.put("/:languageId", authenticateToken, requireAdmin, LanguageController.updateLanguage);
router.delete("/:languageId", authenticateToken, requireAdmin, LanguageController.deleteLanguage);

module.exports = router;
