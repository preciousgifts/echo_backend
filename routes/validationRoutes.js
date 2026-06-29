const express = require('express');
const router = express.Router();
const ValidationController = require('../controllers/validationController');
const { authenticateToken, requireValidator } = require('../middleware/authMiddleware');
const { validate, validationCreateSchema } = require('../middleware/validationMiddleware');

router.post('/create', authenticateToken, requireValidator, validate(validationCreateSchema), ValidationController.createValidation);
router.get('/pending', authenticateToken, requireValidator, ValidationController.getRecordingsForValidation);
router.get('/getValidations', authenticateToken, requireValidator, ValidationController.getValidations);
router.get('/stats', authenticateToken, requireValidator, ValidationController.getValidationStats);

module.exports = router;