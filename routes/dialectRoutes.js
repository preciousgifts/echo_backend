const express = require("express");
const router = express.Router();
const DialectController = require("../controllers/dialectController");
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

router.get("/", DialectController.getAllDialects);
router.post("/get-dialects", DialectController.getAllDialects);
router.post("/add-dialects", authenticateToken, requireAdmin, DialectController.addDialect);
router.put("/:dialectId", authenticateToken, requireAdmin, DialectController.updateDialect);
router.delete("/:dialectId", authenticateToken, requireAdmin, DialectController.deleteDialect);

module.exports = router;
