import express from 'express';
const router = express.Router();
import ValidationController from '../controllers/validationController.js';
import { authenticateToken, requireValidator } from '../middleware/authMiddleware.js';
import { validate, validationCreateSchema } from '../middleware/validationMiddleware.js';

router.post('/create', authenticateToken, requireValidator, validate(validationCreateSchema), ValidationController.createValidation);
router.get('/pending', authenticateToken, requireValidator, ValidationController.getRecordingsForValidation);
router.get('/getValidations', authenticateToken, requireValidator, ValidationController.getValidations);
router.get('/stats', authenticateToken, requireValidator, ValidationController.getValidationStats);

export default router;