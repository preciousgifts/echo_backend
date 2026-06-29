const Joi = require('joi');

const userRegistrationSchema = Joi.object({
  first_name: Joi.string().min(1).max(100).required(),
  last_name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('contributor', 'validator', 'admin').default('contributor'),
  gender: Joi.string().valid('male', 'female', 'other', 'unspecified').default('unspecified'),
  age_range: Joi.string().optional(),
  country: Joi.string().optional(),
  region: Joi.string().optional(),
  primary_language_id: Joi.string().uuid().optional(),
  primary_language_name: Joi.string().optional(),
  dialect_id: Joi.string().uuid().optional(),
  profile_pic: Joi.string().optional().allow(null, ''),
});

const userLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const userUpdateSchema = Joi.object({
  first_name: Joi.string().min(1).max(100).optional(),
  last_name: Joi.string().min(1).max(100).optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  gender: Joi.string().valid('male', 'female', 'other', 'unspecified').optional(),
  age_range: Joi.string().optional(),
  country: Joi.string().optional(),
  region: Joi.string().optional(),
  primary_language_id: Joi.string().uuid().optional(),
  dialect_id: Joi.string().uuid().optional()
});

const promptCreateSchema = Joi.object({
  language_id: Joi.string().uuid().required(),
  dialect_id: Joi.string().uuid().optional().allow(null, ''),
  text: Joi.string().min(1).required(),
  category: Joi.string().optional().allow(''),
  difficulty: Joi.string().valid('easy', 'medium', 'hard').default('medium')
});

const recordingCreateSchema = Joi.object({
  prompt_id: Joi.string().uuid().required(),
  language_id: Joi.string().uuid().required(),
  dialect_id: Joi.string().uuid().optional().allow(null, ''),
  duration: Joi.number().positive().required(),
  file_size: Joi.number().integer().positive().required(),
  device_info: Joi.object().optional(),
  s3_key: Joi.string().optional(),
});

const validationCreateSchema = Joi.object({
  recording_id: Joi.string().uuid().required(),
  result: Joi.string().valid('correct', 'incorrect', 'flagged').required(),
  confidence: Joi.number().min(0).max(1).optional(),
  notes: Joi.string().max(500).optional()
});

const badgeCreateSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().optional(),
  threshold: Joi.number().integer().positive().required(),
  icon_url: Joi.string().uri().optional()
});

const validate = (schema) => {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'Request body is required' });
    }
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }
    next();
  };
};

module.exports = {
  userRegistrationSchema,
  userLoginSchema,
  userUpdateSchema,
  promptCreateSchema,
  recordingCreateSchema,
  validationCreateSchema,
  badgeCreateSchema,
  validate
};