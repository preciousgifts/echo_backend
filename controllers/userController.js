const supabase = require("../config/database");
const logger = require("../config/logger");
const { v4: uuidv4 } = require("uuid");
const EmailService = require("../utils/email");

class UserController {
  static async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 10, role, is_active } = req.query;

      let query = supabase.from("users").select("*", { count: "exact" });

      if (role) {
        query = query.eq("role", role);
      }

      if (is_active !== undefined) {
        query = query.eq("is_active", is_active === "true");
      }

      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: users, error, count } = await query;

      if (error) {
        logger.error("Failed to fetch users", { error: error.message });
        return res.status(400).json({
          success: false,
          message: "Failed to retrieve users",
        });
      }

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      logger.error("Get all users error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to retrieve users",
      });
    }
  }

  static async getUserById(req, res) {
    try {
      const { userId } = req.params;

      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      logger.error("Get user by ID error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user",
      });
    }
  }

  static async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const updates = req.body;

      // Remove sensitive fields
      delete updates.password_hash;
      delete updates.created_at;

      updates.updated_at = new Date();

      const { data: user, error } = await supabase
        .from("users")
        .update(updates)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        logger.error("User update failed", { userId, error: error.message });
        return res.status(400).json({
          success: false,
          message: "Failed to update user",
        });
      }

      logger.info("User updated successfully", {
        userId,
        updatedBy: req.user.user_id,
      });

      res.json({
        success: true,
        message: "User updated successfully",
        data: { user },
      });
    } catch (error) {
      logger.error("Update user error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to update user",
      });
    }
  }

  static async deactivateUser(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.user.user_id;
      const { comment } = req.body || {};

      // Fetch user info before deactivation (for email)
      const { data: targetUser, error: fetchError } = await supabase
        .from("users")
        .select("user_id, email, first_name, last_name, is_active")
        .eq("user_id", userId)
        .single();

      if (fetchError || !targetUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      if (!targetUser.is_active) {
        return res
          .status(400)
          .json({ success: false, message: "User is already inactive" });
      }

      const { error } = await supabase
        .from("users")
        .update({ is_active: false, updated_at: new Date() })
        .eq("user_id", userId);

      if (error) {
        logger.error("User deactivation failed", {
          userId,
          error: error.message,
        });
        return res
          .status(400)
          .json({ success: false, message: "Failed to deactivate user" });
      }

      // Fetch admin info for audit trail
      const { data: adminUser } = await supabase
        .from("users")
        .select("first_name, last_name, email")
        .eq("user_id", adminId)
        .single();

      const adminName = adminUser
        ? `${adminUser.first_name || ""} ${adminUser.last_name || ""}`.trim()
        : "An administrator";

      // Attempt to log audit trail (non-blocking)
      supabase
        .from("admin_actions")
        .insert([
          {
            action_id: uuidv4(),
            admin_id: adminId,
            action_type: "user_deactivation",
            details: { deactivated_user_id: userId, comment: comment || null },
          },
        ])
        .then(() => {})
        .catch(() => {});

      // Send email notification to deactivated user
      const firstName = targetUser.first_name || "User";
      const commentText = comment
        ? `<p><strong>Reason:</strong> ${comment}</p>`
        : "";
      EmailService.sendCustomEmail(
        targetUser.email,
        firstName,
        "Your Echo Account Has Been Deactivated",
        `<h2>Account Deactivated</h2>
        <p>Hi ${firstName},</p>
        <p>Your Echo account has been deactivated.</p>
        ${commentText}
        <p>If you believe this is a mistake, please contact our support team.</p>
        <p>Best regards,<br/>Echo Platform Team</p>`,
      ).catch(() => {});

      logger.info("User deactivated successfully", {
        userId,
        adminId,
        comment,
      });

      res.json({
        success: true,
        message: "User deactivated and notified by email",
      });
    } catch (error) {
      logger.error("Deactivate user error", { error: error.message });
      res
        .status(500)
        .json({ success: false, message: "Failed to deactivate user" });
    }
  }

  static async reactivateUser(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.user.user_id;

      const { data: targetUser, error: fetchError } = await supabase
        .from("users")
        .select("user_id, email, first_name, last_name, is_active")
        .eq("user_id", userId)
        .single();

      if (fetchError || !targetUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      if (targetUser.is_active) {
        return res
          .status(400)
          .json({ success: false, message: "User is already active" });
      }

      const { error } = await supabase
        .from("users")
        .update({ is_active: true, updated_at: new Date() })
        .eq("user_id", userId);

      if (error) {
        logger.error("User reactivation failed", {
          userId,
          error: error.message,
        });
        return res
          .status(400)
          .json({ success: false, message: "Failed to reactivate user" });
      }

      const { data: adminUser } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("user_id", adminId)
        .single();

      const adminName = adminUser
        ? `${adminUser.first_name || ""} ${adminUser.last_name || ""}`.trim()
        : "An administrator";

      supabase
        .from("admin_actions")
        .insert([
          {
            action_id: uuidv4(),
            admin_id: adminId,
            action_type: "user_reactivation",
            details: { reactivated_user_id: userId },
          },
        ])
        .then(() => {})
        .catch(() => {});

      const firstName = targetUser.first_name || "User";
      EmailService.sendCustomEmail(
        targetUser.email,
        firstName,
        "Your Echo Account Has Been Reactivated",
        `<h2>Account Reactivated</h2>
        <p>Hi ${firstName},</p>
        <p>Your Echo account has been reactivated. You can now log in and continue contributing.</p>
        <p>Best regards,<br/>Echo Platform Team</p>`,
      ).catch(() => {});

      logger.info("User reactivated successfully", { userId, adminId });

      res.json({
        success: true,
        message: "User reactivated and notified by email",
      });
    } catch (error) {
      logger.error("Reactivate user error", { error: error.message });
      res
        .status(500)
        .json({ success: false, message: "Failed to reactivate user" });
    }
  }

  static async getUserStats(req, res) {
    try {
      const { userId } = req.params;

      // Get user recordings count by status
      const { data: recordings, error: recordingsError } = await supabase
        .from("recordings")
        .select("status")
        .eq("user_id", userId);

      if (recordingsError) {
        logger.error("Failed to fetch user recordings", {
          userId,
          error: recordingsError.message,
        });
      }

      // Get validations count
      const { data: validations, error: validationsError } = await supabase
        .from("validations")
        .select("result")
        .eq("validator_id", userId);

      const stats = {
        total_recordings: recordings?.length || 0,
        validated_recordings:
          recordings?.filter((r) => r.status === "validated").length || 0,
        pending_recordings:
          recordings?.filter((r) => r.status === "pending").length || 0,
        total_validations: validations?.length || 0,
        correct_validations:
          validations?.filter((v) => v.result === "correct").length || 0,
        incorrect_validations:
          validations?.filter((v) => v.result === "incorrect").length || 0,
      };

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error("Get user stats error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user statistics",
      });
    }
  }

  static async getUserRecordings(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10, status } = req.query;

      let query = supabase
        .from("recordings")
        .select(
          `
          *,
          prompts(text, category, difficulty),
          languages(name),
          dialects(name)
        `,
        )
        .eq("user_id", userId);

      if (status) {
        query = query.eq("status", status);
      }

      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: recordings, error } = await query;

      if (error) {
        logger.error("Failed to fetch user recordings", {
          userId,
          error: error.message,
        });
        return res.status(400).json({
          success: false,
          message: "Failed to retrieve recordings",
        });
      }

      res.json({
        success: true,
        data: { recordings },
      });
    } catch (error) {
      logger.error("Get user recordings error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to retrieve recordings",
      });
    }
  }

  static async createValidatorAccount(req, res) {
    try {
      const adminId = req.user.user_id;

      // Ensure only admins can perform this
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied: Only admins can create validator accounts",
        });
      }

      const { first_name, last_name, email, password } = req.body;

      if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "first_name, last_name, email, and password are required",
        });
      }

      // Check if email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", email)
        .single();

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "A user with this email already exists",
        });
      }

      // Hash password before saving
      const bcrypt = require("bcryptjs");
      const password_hash = await bcrypt.hash(password, 10);

      const newUser = {
        user_id: uuidv4(),
        first_name,
        last_name,
        email,
        password_hash,
        role: "validator", // assign validator role
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Insert into database
      const { data: createdUser, error: insertError } = await supabase
        .from("users")
        .insert([newUser])
        .select()
        .single();

      if (insertError) {
        logger.error("Failed to create validator account", {
          error: insertError.message,
        });
        return res.status(400).json({
          success: false,
          message: "Failed to create validator account",
        });
      }

      // Log admin action
      await supabase.from("admin_actions").insert([
        {
          action_id: uuidv4(),
          admin_id: adminId,
          action_type: "create_validator",
          details: { userId: createdUser.user_id, email },
          created_at: new Date(),
        },
      ]);

      logger.info("Validator account created successfully", {
        adminId,
        userId: createdUser.user_id,
      });

      res.json({
        success: true,
        message: "Validator account created successfully",
        data: {
          user_id: createdUser.user_id,
          email: createdUser.email,
          role: createdUser.role,
        },
      });
    } catch (error) {
      logger.error("Create validator account error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to create validator account",
      });
    }
  }
}

module.exports = UserController;
