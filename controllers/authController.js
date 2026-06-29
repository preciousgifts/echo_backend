const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");
const EmailService = require("../utils/email");
const logger = require("../config/logger");
const { randomInt } = require("crypto");
const { error } = require("console");

class AuthController {
  static async register(req, res) {
    try {
      const {
        first_name,
        last_name,
        email,
        phone,
        password,
        role,
        gender,
        age_range,
        country,
        region,
        primary_language_id,
        primary_language_name,
        dialect_id,
        profile_pic,
      } = req.body;

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("user_id")
        .or(`email.eq.${email}${phone ? `,phone.eq.${phone}` : ""}`)
        .single();

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "User with this email or phone already exists",
        });
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const newUser = {
        user_id: uuidv4(),
        first_name,
        last_name,
        email,
        phone,
        password_hash: passwordHash,
        role: role || "contributor",
        gender: gender || "unspecified",
        age_range,
        country,
        region,
        primary_language_id,
        primary_language_name,
        dialect_id,
        points: 0,
        level: 1,
        badges: [],
        is_active: true,
        profile_pic: profile_pic || null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const { data: user, error } = await supabase
        .from("users")
        .insert([newUser])
        .select()
        .single();

      if (error) {
        logger.error("User creation failed", { error: error.message, email });
        return res.status(400).json({
          success: false,
          message: "Failed to create user account",
        });
      }

      // Send welcome email
      await EmailService.sendWelcomeEmail(email, first_name);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.user_id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      logger.info("User registered successfully", {
        userId: user.user_id,
        email,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            profile_pic: user.profile_pic,
          },
          token,
        },
      });
    } catch (error) {
      logger.error("Registration error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Internal server error during registration",
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (error || !user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Update last login
      await supabase
        .from("users")
        .update({ last_login_at: new Date() })
        .eq("user_id", user.user_id);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.user_id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      logger.info("User logged in successfully", { userId: user.user_id });

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            points: user.points,
            level: user.level,
            profile_pic: user.profile_pic,
            language_id: user.primary_language_id,
            language_name: user.primary_language_name,
            country: user.country,
            region: user.region,
          },
          token,
        },
      });
    } catch (error) {
      logger.error("Login error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Internal server error during login",
      });
    }
  }

  static async getProfile(req, res) {
    try {
      const user = req.user;

      res.json({
        success: true,
        data: {
          user: {
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            gender: user.gender,
            age_range: user.age_range,
            country: user.country,
            region: user.region,
            points: user.points,
            level: user.level,
            badges: user.badges,
            last_login_at: user.last_login_at,
            created_at: user.created_at,
          },
        },
      });
    } catch (error) {
      logger.error("Get profile error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to retrieve profile",
      });
    }
  }

  static async updateProfile(req, res) {
    try {
      const userId = req.user.user_id;
      const updates = req.body;

      // Remove fields that shouldn't be updated
      delete updates.password_hash;
      delete updates.role;
      delete updates.points;
      delete updates.level;

      updates.updated_at = new Date();

      const { data: user, error } = await supabase
        .from("users")
        .update(updates)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        logger.error("Profile update failed", { userId, error: error.message });
        return res.status(400).json({
          success: false,
          message: "Failed to update profile",
        });
      }

      logger.info("Profile updated successfully", { userId });

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: { user },
      });
    } catch (error) {
      logger.error("Update profile error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }
  }

  static async changePassword(req, res) {
    try {
      const userId = req.user.user_id;
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "currentPassword and newPassword are required" });
      }

      // Get user with password hash
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        return res.status(400).json({
          success: false,
          message: "User not found",
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password_hash
      );

      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      const { error: updateError } = await supabase
        .from("users")
        .update({
          password_hash: newPasswordHash,
          updated_at: new Date(),
        })
        .eq("user_id", userId);

      if (updateError) {
        logger.error("Password change failed", {
          userId,
          error: updateError.message,
        });
        return res.status(400).json({
          success: false,
          message: "Failed to change password",
        });
      }

      logger.info("Password changed successfully", { userId });

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      logger.error("Change password error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to change password",
      });
    }
  }

  static async requestPasswordOtp(req, res) {
    try {
      const { email } = req.body;

      const { data: user, error } = await supabase
        .from("users")
        .select("user_id, first_name")
        .eq("email", email)
        .single();

      // Don't reveal existence of email
      if (error || !user) {
        return res.status(404).json({
          success: false,
          message:
            "An error occurred while processing the password reset request. No user found.",
        });
      }

      // Generate 6-digit OTP
      const otp = randomInt(100000, 999999).toString();

      // Store OTP in database with 10-minute expiry
      const { error: updateError } = await supabase
        .from("password_resets")
        .upsert(
          {
            user_id: user.user_id,
            otp,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (updateError) throw new Error(updateError.message);

      // Send OTP email
      await EmailService.sendOTP(email, otp, user.first_name);

      logger.info("OTP sent", { userId: user.user_id });

      res.json({
        success: true,
        message: "If an account with that email exists, an OTP has been sent.",
      });
    } catch (error) {
      logger.error("OTP request error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to process OTP request",
      });
    }
  }

  static async validateOtp(req, res) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ success: false, message: "Email and OTP are required" });
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", email)
        .single();

      if (userError || !user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const { data: otpRecord, error: otpError } = await supabase
        .from("password_resets")
        .select("otp, expires_at")
        .eq("user_id", user.user_id)
        .maybeSingle();

      if (otpError) {
        return res.status(400).json({ success: false, message: "Failed to retrieve OTP record" });
      }
      if (!otpRecord) {
        return res.status(400).json({ success: false, message: "OTP not found or already used" });
      }
      if (otpRecord.otp !== otp) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }
      if (new Date(otpRecord.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: "OTP has expired" });
      }

      return res.status(200).json({ success: true, message: "OTP verified successfully" });
    } catch (error) {
      logger.error("OTP validation error", { error: error.message });
      return res.status(500).json({ success: false, message: "Failed to validate OTP" });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { email, otp, newPassword } = req.body;

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", email)
        .single();

      if (userError || !user) {
        return res.status(400).json({ success: false, message: "Invalid request" });
      }

      const { data: record, error: recordError } = await supabase
        .from("password_resets")
        .select("*")
        .eq("user_id", user.user_id)
        .eq("otp", otp)
        .single();

      if (recordError || !record) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      }

      if (new Date(record.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: "OTP has expired" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      const { error: updateErr } = await supabase
        .from("users")
        .update({ password_hash: hashedPassword, updated_at: new Date() })
        .eq("user_id", user.user_id);

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      await supabase.from("password_resets").delete().eq("user_id", user.user_id);

      res.json({ success: true, message: "Password reset successful" });
    } catch (error) {
      logger.error("Verify password reset error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to verify OTP or reset password",
      });
    }
  }

  static async sendRegistrationOtp(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      // Check if previous OTP exists for rate limiting
      const { data: existingOtp } = await supabase
        .from("registration_otp")
        .select("attempts, last_sent_at")
        .eq("email", email)
        .single();

      // Rate limit: max 3 requests in 10 minutes
      if (existingOtp) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        if (
          existingOtp.attempts >= 3 &&
          new Date(existingOtp.last_sent_at) > tenMinutesAgo
        ) {
          return res.status(429).json({
            success: false,
            message: "Too many OTP requests. Try again in a few minutes.",
          });
        }
      }

      // Generate OTP
      const otp = randomInt(100000, 999999).toString();

      // Prepare upsert data
      const otpPayload = {
        email,
        otp,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
        attempts: existingOtp ? existingOtp.attempts + 1 : 1,
        last_sent_at: new Date().toISOString(),
      };

      // Save OTP
      const { error: updateError } = await supabase
        .from("registration_otp")
        .upsert(otpPayload, { onConflict: "email" });

      if (updateError) throw updateError;

      // Send OTP email
      await EmailService.sendOTP(email, otp);

      return res.json({
        success: true,
        message: "OTP sent successfully",
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Failed to send registration OTP",
      });
    }
  }

  static async validateRegistrationOtp(req, res) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: "Email and OTP are required",
        });
      }

      // Get OTP record
      const { data: otpRecord, error } = await supabase
        .from("registration_otp")
        .select("otp, expires_at")
        .eq("email", email)
        .single();

      if (error || !otpRecord) {
        return res.status(400).json({
          success: false,
          message: "OTP not found",
        });
      }

      // Compare OTP
      if (otpRecord.otp !== otp) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP",
        });
      }

      // Check expiration

      const expiresAt = new Date(otpRecord.expires_at).getTime();
      const now = Date.now(); // always UTC internally

      const isExpired = expiresAt < now;
      console.log("EXPIRES_AT:", otpRecord.expires_at);
      console.log("NOW:", new Date().toISOString());
      console.log("EXPIRED:", expiresAt < now);

      // const isExpired = new Date(otpRecord.expires_at) < new Date();
      if (isExpired) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired",
        });
      }

      // Delete OTP record after successful validation
      await supabase.from("registration_otp").delete().eq("email", email);

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Failed to validate registration OTP",
      });
    }
  }

  static async deleteAccount(req, res) {
    try {
      const userId = req.user.user_id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ success: false, message: "Password is required to delete account" });
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("password_hash")
        .eq("user_id", userId)
        .single();

      if (userError || !user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ success: false, message: "Incorrect password" });
      }

      // Soft delete — deactivate rather than hard delete to preserve data integrity
      const { error: deleteError } = await supabase
        .from("users")
        .update({ is_active: false, email: `deleted_${userId}@echo.app`, updated_at: new Date() })
        .eq("user_id", userId);

      if (deleteError) {
        logger.error("Account deletion failed", { userId, error: deleteError.message });
        return res.status(400).json({ success: false, message: "Failed to delete account" });
      }

      logger.info("Account deleted (deactivated)", { userId });

      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      logger.error("Delete account error", { error: error.message });
      res.status(500).json({ success: false, message: "Failed to delete account" });
    }
  }
}

module.exports = AuthController;
