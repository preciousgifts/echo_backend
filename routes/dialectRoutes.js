import express from "express";
const router = express.Router();
import DialectController from "../controllers/dialectController.js";
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

router.get("/", DialectController.getAllDialects);
router.post("/get-dialects", DialectController.getAllDialects);
router.post("/add-dialects", authenticateToken, requireAdmin, DialectController.addDialect);
router.put("/:dialectId", authenticateToken, requireAdmin, DialectController.updateDialect);
router.delete("/:dialectId", authenticateToken, requireAdmin, DialectController.deleteDialect);

export default router;
