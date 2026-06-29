const supabase = require("../config/database");
const logger = require("../config/logger");
const { v4: uuidv4 } = require("uuid");

class PromptController {
  static async createPrompt(req, res) {
    try {
      const adminId = req.user.user_id;
      const { language_id, dialect_id, text, category, difficulty } = req.body;

      const promptData = {
        prompt_id: uuidv4(),
        language_id,
        dialect_id: dialect_id || null,
        text,
        category,
        difficulty,
        status: "active",
        created_by: adminId,
        created_at: new Date(),
      };

      const { data: prompt, error } = await supabase
        .from("prompts")
        .insert([promptData])
        .select('*')
        .single();

      if (error) {
        logger.error("Prompt creation failed", {
          adminId,
          error: error.message,
        });
        return res.status(400).json({
          success: false,
          message: "Failed to create prompt",
        });
      }

      logger.info("Prompt created successfully", {
        promptId: prompt.prompt_id,
        adminId,
      });

      res.status(201).json({
        success: true,
        message: "Prompt created successfully",
        data: { prompt },
      });
    } catch (error) {
      logger.error("Create prompt error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to create prompt",
      });
    }
  }

  static async getPrompts(req, res) {
    try {
      const userId = req.user?.user_id;
      const {
        page = 1,
        limit = 10,
        language_id,
        dialect_id,
        difficulty,
        status,
      } = req.body;

      if (!language_id) {
        return res.status(201).json({
          success: true,
          message: "Kindly select language to proceed",
        });
      }

      if (!dialect_id) {
        return res.status(201).json({
          success: true,
          message: "Kindly select dialect to proceed",
        });
      }

      // Find prompt_ids this user has already recorded
      let doneIds = [];
      if (userId) {
        const { data: done } = await supabase
          .from("recordings")
          .select("prompt_id")
          .eq("user_id", userId)
          .eq("language_id", language_id);
        doneIds = (done || []).map((r) => r.prompt_id).filter(Boolean);
      }

      let query = supabase
        .from("prompts")
        .select("*", { count: "exact" })
        .eq("language_id", language_id)
        .eq("dialect_id", dialect_id);

      if (doneIds.length > 0) {
        query = query.not("prompt_id", "in", `(${doneIds.join(",")})`);
      }

      if (difficulty) query = query.eq("difficulty", difficulty);
      if (status) query = query.eq("status", status);

      const offset = (parseInt(page) - 1) * parseInt(limit);
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: prompts, error, count } = await query;

      if (error) {
        logger.error("Failed to fetch prompts", { error: error.message });
        return res.status(400).json({
          success: false,
          message: "Failed to retrieve prompts",
        });
      }

      return res.json({
        success: true,
        data: {
          prompts,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      logger.error("Get prompts error", { error: error.message });
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve prompts",
      });
    }
  }

  static async getRandomPrompt(req, res) {
    try {
      const { language_id, difficulty } = req.query;

      let query = supabase.from("prompts").select("*").eq("status", "active");

      if (language_id) {
        query = query.eq("language_id", language_id);
      }

      if (difficulty) {
        query = query.eq("difficulty", difficulty);
      }

      const { data: prompts, error } = await query;

      if (error || !prompts || prompts.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No prompts available for the specified criteria",
        });
      }

      // Get random prompt
      const randomIndex = Math.floor(Math.random() * prompts.length);
      const randomPrompt = prompts[randomIndex];

      res.json({
        success: true,
        data: { prompt: randomPrompt },
      });
    } catch (error) {
      logger.error("Get random prompt error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to retrieve prompt",
      });
    }
  }

  static async listAllPrompts(req, res) {
    try {
      const { page = 1, limit = 20, language_id, difficulty, status, search } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = supabase
        .from('prompts')
        .select('*, languages(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (language_id) query = query.eq('language_id', language_id);
      if (difficulty) query = query.eq('difficulty', difficulty);
      if (status) query = query.eq('status', status);
      if (search) query = query.ilike('text', `%${search}%`);

      const { data: prompts, error, count } = await query;
      if (error) return res.status(400).json({ success: false, message: 'Failed to retrieve prompts' });

      res.json({
        success: true,
        data: {
          prompts,
          pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / parseInt(limit)) },
        },
      });
    } catch (error) {
      logger.error('List prompts error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to retrieve prompts' });
    }
  }

  static async deletePrompt(req, res) {
    try {
      const { promptId } = req.params;
      const { error } = await supabase.from('prompts').delete().eq('prompt_id', promptId);
      if (error) return res.status(400).json({ success: false, message: 'Failed to delete prompt' });
      logger.info('Prompt deleted', { promptId, adminId: req.user.user_id });
      res.json({ success: true, message: 'Prompt deleted successfully' });
    } catch (error) {
      logger.error('Delete prompt error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to delete prompt' });
    }
  }

  static async updatePrompt(req, res) {
    try {
      const { promptId } = req.params;
      const updates = req.body;

      const { data: prompt, error } = await supabase
        .from("prompts")
        .update(updates)
        .eq("prompt_id", promptId)
        .select()
        .single();

      if (error) {
        logger.error("Prompt update failed", {
          promptId,
          error: error.message,
        });
        return res.status(400).json({
          success: false,
          message: "Failed to update prompt",
        });
      }

      logger.info("Prompt updated successfully", { promptId });

      res.json({
        success: true,
        message: "Prompt updated successfully",
        data: { prompt },
      });
    } catch (error) {
      logger.error("Update prompt error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to update prompt",
      });
    }
  }
}

module.exports = PromptController;
