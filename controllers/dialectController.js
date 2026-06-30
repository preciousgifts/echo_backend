import supabase from "../config/database.js";
import logger from "../config/logger.js";

class DialectController {
  // Get all dialects (optionally filtered by language_id)
  static async getAllDialects(req, res) {
    try {
      const language_id = req.query.language_id || req.body?.language_id;

      let query = supabase.from("dialects").select("*");

      if (language_id) {
        query = query.eq("language_id", language_id);
      }

      const { data: dialects, error } = await query.order("name", {
        ascending: true,
      });

      if (error) {
        logger.error("Failed to fetch dialects", { error: error.message });
        return res.status(400).json({
          success: false,
          message: "Failed to fetch dialects",
        });
      }

      res.json({
        success: true,
        message: "Dialects fetched successfully",
        data: dialects,
      });
    } catch (error) {
      logger.error("Server error fetching dialects", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Internal server error while fetching dialects",
      });
    }
  }

  static async updateDialect(req, res) {
    try {
      const { dialectId } = req.params;
      const { name, description, region } = req.body || {};
      const { data, error } = await supabase
        .from('dialects')
        .update({ name, description, region, updated_at: new Date() })
        .eq('dialect_id', dialectId)
        .select()
        .single();
      if (error) return res.status(400).json({ success: false, message: 'Failed to update dialect' });
      res.json({ success: true, message: 'Dialect updated successfully', data });
    } catch (error) {
      logger.error('Update dialect error', { error: error.message });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async deleteDialect(req, res) {
    try {
      const { dialectId } = req.params;
      const { error } = await supabase.from('dialects').delete().eq('dialect_id', dialectId);
      if (error) return res.status(400).json({ success: false, message: 'Failed to delete dialect' });
      res.json({ success: true, message: 'Dialect deleted successfully' });
    } catch (error) {
      logger.error('Delete dialect error', { error: error.message });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Add a new dialect
  static async addDialect(req, res) {
    try {
      const { language_id, name, description, region } = req.body;

      // Validate required fields
      if (!language_id || !name || !description || !region) {
        return res.status(400).json({
          success: false,
          message:
            "All fields (language_id, name, description, region) are required",
        });
      }

      // Check if language_id exists
      const { data: language, error: langError } = await supabase
        .from("languages")
        .select("language_id")
        .eq("language_id", language_id)
        .single();

      if (langError || !language) {
        logger.error("Invalid language_id provided", {
          error: langError?.message,
        });
        return res.status(400).json({
          success: false,
          message: "Invalid language_id: language does not exist",
        });
      }

      // Check if dialect already exists for the same language
      const { data: existing, error: checkError } = await supabase
        .from("dialects")
        .select("*")
        .eq("language_id", language_id)
        .eq("name", name);

      if (checkError) {
        logger.error("Failed to check existing dialects", {
          error: checkError.message,
        });
        return res.status(400).json({
          success: false,
          message: "Error checking for existing dialects",
        });
      }

      if (existing && existing.length > 0) {
        return res.status(409).json({
          success: false,
          message:
            "A dialect with the same name already exists for this language",
        });
      }

      // Insert new dialect
      const { data: inserted, error: insertError } = await supabase
        .from("dialects")
        .insert([{ language_id, name, description, region }])
        .select();

      if (insertError) {
        logger.error("Failed to insert new dialect", {
          error: insertError.message,
        });
        return res.status(400).json({
          success: false,
          message: "Failed to add dialect",
        });
      }

      res.status(201).json({
        success: true,
        message: "Dialect added successfully",
        data: inserted[0],
      });
    } catch (error) {
      logger.error("Server error adding dialect", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Internal server error while adding dialect",
      });
    }
  }
}

export default DialectController;
