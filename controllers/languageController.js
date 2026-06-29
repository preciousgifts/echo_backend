const supabase = require("../config/database");
const logger = require("../config/logger");

class LanguageController {
  // Get all languages
  static async getAllLanguages(req, res) {
    try {
      const { data: languages, error } = await supabase
        .from("languages")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        logger.error("Failed to fetch languages", { error: error.message });
        return res.status(400).json({
          success: false,
          message: "Failed to fetch languages",
        });
      }

      res.json({
        success: true,
        message: "Languages fetched successfully",
        data: languages,
      });
    } catch (error) {
      logger.error("Server error fetching languages", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Internal server error while fetching languages",
      });
    }
  }

  static async updateLanguage(req, res) {
    try {
      const { languageId } = req.params;
      const { name, iso_code, family, region } = req.body || {};
      const { data, error } = await supabase
        .from('languages')
        .update({ name, iso_code, family, region, updated_at: new Date() })
        .eq('language_id', languageId)
        .select()
        .single();
      if (error) return res.status(400).json({ success: false, message: 'Failed to update language' });
      res.json({ success: true, message: 'Language updated successfully', data });
    } catch (error) {
      logger.error('Update language error', { error: error.message });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async deleteLanguage(req, res) {
    try {
      const { languageId } = req.params;
      const { error } = await supabase.from('languages').delete().eq('language_id', languageId);
      if (error) return res.status(400).json({ success: false, message: 'Failed to delete language' });
      res.json({ success: true, message: 'Language deleted successfully' });
    } catch (error) {
      logger.error('Delete language error', { error: error.message });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Add a new language
  static async addLanguage(req, res) {
    try {
      const { name, iso_code, family, region } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Name is required",
        });
      }

      // Check if language already exists
      const { data: existing, error: checkError } = await supabase
        .from("languages")
        .select("*")
        .or(`name.eq.${name},iso_code.eq.${iso_code}`);

      if (checkError) {
        logger.error("Failed to check existing languages", {
          error: checkError.message,
        });
        return res.status(400).json({
          success: false,
          message: "Error checking for existing languages",
        });
      }

      if (existing && existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Language with the same name or ISO code already exists",
        });
      }

      // Insert new language
      const { data: inserted, error: insertError } = await supabase
        .from("languages")
        .insert([{ name, iso_code, family, region }])
        .select();

      if (insertError) {
        logger.error("Failed to insert new language", {
          error: insertError.message,
        });
        return res.status(400).json({
          success: false,
          message: "Failed to add language",
        });
      }

      res.status(201).json({
        success: true,
        message: "Language added successfully",
        data: inserted[0],
      });
    } catch (error) {
      logger.error("Server error adding language", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Internal server error while adding language",
      });
    }
  }
}

module.exports = LanguageController;
