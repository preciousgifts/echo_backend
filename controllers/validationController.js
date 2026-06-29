const supabase = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class ValidationController {
  static async createValidation(req, res) {
    try {
      const validatorId = req.user.user_id;
      const { recording_id, result, confidence, notes } = req.body || {};
      if (!recording_id || !result) {
        return res.status(400).json({ success: false, message: 'recording_id and result are required' });
      }

      // Prevent validating own recording
      const { data: recOwner } = await supabase
        .from('recordings')
        .select('user_id, validator_count')
        .eq('recording_id', recording_id)
        .single();

      if (!recOwner) {
        return res.status(404).json({ success: false, message: 'Recording not found' });
      }
      if (recOwner.user_id === validatorId) {
        return res.status(403).json({ success: false, message: 'You cannot validate your own recording' });
      }

      // Prevent duplicate validation
      const { data: existing } = await supabase
        .from('validations')
        .select('validation_id')
        .eq('recording_id', recording_id)
        .eq('validator_id', validatorId)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ success: false, message: 'You have already validated this recording' });
      }

      const { data: validation, error } = await supabase
        .from('validations')
        .insert([{
          validation_id: uuidv4(),
          recording_id,
          validator_id: validatorId,
          result,
          confidence: confidence || 0.8,
          notes,
          created_at: new Date(),
        }])
        .select('*')
        .single();

      if (error) {
        logger.error('Validation creation failed', { validatorId, error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to create validation' });
      }

      const newCount = (recOwner.validator_count || 0) + 1;
      const REQUIRED = parseInt(process.env.VALIDATION_REQUIRED_COUNT) || 3;

      const { count: correctCount } = await supabase
        .from('validations')
        .select('*', { count: 'exact', head: true })
        .eq('recording_id', recording_id)
        .eq('result', 'correct');

      const totalCorrect = (correctCount || 0) + (result === 'correct' ? 1 : 0);
      const newStatus = totalCorrect >= REQUIRED ? 'validated' : result === 'incorrect' ? 'rejected' : 'pending';

      await supabase
        .from('recordings')
        .update({ validator_count: newCount, status: newStatus, updated_at: new Date() })
        .eq('recording_id', recording_id);

      await supabase.rpc('increment_user_points', { user_id: validatorId, points_to_add: 2 });

      logger.info('Validation created successfully', { validationId: validation.validation_id, validatorId });

      res.status(201).json({
        success: true,
        message: 'Validation submitted successfully',
        data: { validation },
      });
    } catch (error) {
      logger.error('Create validation error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to create validation' });
    }
  }

  // Returns recordings pending validation — excludes own recordings and already-validated ones
  static async getRecordingsForValidation(req, res) {
    try {
      const validatorId = req.user.user_id;
      const { page = 1, limit = 20, language_id, dialect_id } = req.query;

      if (!language_id) {
        return res.status(400).json({ success: false, message: 'language_id is required' });
      }

      // Exclude recordings already validated by this validator
      const { data: alreadyValidated } = await supabase
        .from('validations')
        .select('recording_id')
        .eq('validator_id', validatorId);

      const excludeIds = (alreadyValidated || []).map((v) => v.recording_id);

      let query = supabase
        .from('recordings')
        .select(
          `recording_id, prompt_id, language_id, dialect_id, duration, file_path, status, created_at,
          prompts(text, category, difficulty), languages(name), dialects(name), users(first_name, last_name)`,
          { count: 'exact' }
        )
        .eq('status', 'pending')
        .eq('language_id', language_id)
        .neq('user_id', validatorId); // exclude own recordings

      if (dialect_id) {
        query = query.eq('dialect_id', dialect_id);
      }

      if (excludeIds.length > 0) {
        query = query.not('recording_id', 'in', `(${excludeIds.join(',')})`);
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);
      query = query.range(offset, offset + parseInt(limit) - 1).order('created_at', { ascending: false });

      const { data: recordings, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch recordings for validation', { error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to retrieve recordings for validation' });
      }

      res.json({
        success: true,
        data: {
          recordings,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            totalPages: Math.ceil((count || 0) / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      logger.error('Get recordings for validation error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to retrieve recordings for validation' });
    }
  }

  static async getValidations(req, res) {
    try {
      const { page = 1, limit = 10, result, recording_id } = req.query;

      let query = supabase.from('validations').select('*', { count: 'exact' });
      if (result) query = query.eq('result', result);
      if (recording_id) query = query.eq('recording_id', recording_id);

      const offset = (parseInt(page) - 1) * parseInt(limit);
      query = query.range(offset, offset + parseInt(limit) - 1).order('created_at', { ascending: false });

      const { data: validations, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch validations', { error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to retrieve validations' });
      }

      res.json({
        success: true,
        data: {
          validations,
          pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil((count || 0) / parseInt(limit)) },
        },
      });
    } catch (error) {
      logger.error('Get validations error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to retrieve validations' });
    }
  }

  static async getValidationStats(req, res) {
    try {
      const validatorId = req.user.user_id;
      const { data: validations, error } = await supabase
        .from('validations')
        .select('result')
        .eq('validator_id', validatorId);

      if (error) {
        return res.status(400).json({ success: false, message: 'Failed to retrieve validation statistics' });
      }

      const total = validations?.length || 0;
      const correct = validations?.filter((v) => v.result === 'correct').length || 0;
      const incorrect = validations?.filter((v) => v.result === 'incorrect').length || 0;
      const flagged = validations?.filter((v) => v.result === 'flagged').length || 0;

      res.json({
        success: true,
        data: {
          stats: {
            total_validations: total,
            correct_validations: correct,
            incorrect_validations: incorrect,
            flagged_validations: flagged,
            accuracy_rate: total ? parseFloat(((correct / total) * 100).toFixed(1)) : 0,
          },
        },
      });
    } catch (error) {
      logger.error('Get validation stats error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to retrieve validation statistics' });
    }
  }
}

module.exports = ValidationController;
