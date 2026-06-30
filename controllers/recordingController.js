import supabase from "../config/database.js";
import logger from "../config/logger.js";
import "dotenv/config";
import { v4 as uuidv4 } from "uuid";
import { uploadBuffer, getPresignedPutUrl, getPresignedGetUrl, deleteFromS3, } from "../config/s3.js";

class RecordingController {
  /**
   * Returns a presigned PUT URL for the client to upload directly to S3.
   * Useful for offline-first flow: client obtains URL when online and uploads file.
   * POST /recordings/upload-url
   * Body: { filename, contentType }
   */
  static async getUploadUrl(req, res) {
    try {
      const { filename, contentType } = req.body;
      if (!filename) {
        return res
          .status(400)
          .json({ success: false, message: "filename is required" });
      }
      const key = `recordings/${uuidv4()}-${filename}`;
      const putUrl = await getPresignedPutUrl(
        key,
        contentType || "audio/wav",
        900
      ); // 15 minutes
      return res.json({
        success: true,
        data: { uploadUrl: putUrl, s3_key: key },
      });
    } catch (error) {
      logger.error("Get upload url error", { error: error.message });
      return res
        .status(500)
        .json({ success: false, message: "Failed to get upload url" });
    }
  }

  /**
   * Create a recording entry.
   * Accepts:
   * - req.file.buffer (when using multer memoryStorage) => server uploads to S3
   * - or body.s3_key (when client uploaded directly to S3 using presigned URL)
   */
  static async createRecording(req, res) {
    try {
      const userId = req.user.user_id;
      const {
        prompt_id,
        language_id,
        dialect_id,
        duration,
        file_size,
        device_info,
        s3_key,
      } = req.body;

      // we'll persist S3 key (or public URL if preferred)
      let file_path = null;

      // If file supplied to server (multer memoryStorage), upload buffer to S3
      if (req.file && req.file.buffer) {
        const originalName = req.file.originalname || "recording.wav";
        const key = `recordings/${uuidv4()}-${originalName}`;
        await uploadBuffer(
          req.file.buffer,
          key,
          req.file.mimetype || "audio/wav"
        );
        file_path = key;
      } else if (s3_key) {
        // Client indicates the file is already uploaded to S3 (presigned flow)
        file_path = s3_key;
      } else if (req.file && req.file.path) {
        // fallback: still store local path (not recommended for production)
        file_path = req.file.path;
      }

      if (!file_path) {
        return res.status(400).json({
          success: false,
          message:
            "Audio file is required (either upload file to this endpoint or provide s3_key)",
        });
      }

      const recordingData = {
        recording_id: uuidv4(),
        user_id: userId,
        prompt_id,
        language_id,
        dialect_id: dialect_id || null,
        file_path,
        file_size,
        duration,
        device_info: device_info ? JSON.parse(device_info) : {},
        status: "pending",
        validator_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const { data: recording, error } = await supabase
        .from("recordings")
        .insert([recordingData])
        .select(
          `
          *,
          prompts(text, category),
          languages(name),
          dialects(name)
        `
        )
        .single();

      if (error) {
        logger.error("Recording creation failed", {
          userId,
          error: error.message,
        });
        return res.status(400).json({
          success: false,
          message: "Failed to create recording",
          error: error.message,
        });
      }

      const recording_point = process.env.RECORDING_POINT || 2; // Points for submitting a recording

      // Update user points
      await supabase.rpc("increment_user_points", {
        user_id: userId,
        points_to_add: recording_point, // Points for submitting a recording
      });

      logger.info("Recording created successfully", {
        recordingId: recording.recording_id,
        userId,
      });

      // Add download_url for immediate client use (signed URL)
      let download_url = null;
      try {
        download_url = await getPresignedGetUrl(recording.file_path, 3600);
      } catch (e) {
        // ignore if presign fails, not critical
      }

      res.status(201).json({
        success: true,
        message: "Recording submitted successfully",
        data: { recording },
      });
    } catch (error) {
      logger.error("Create recording error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to create recording",
        error: error.message,
        details: error.stack,
      });
    }
  }

  static async getRecordings(req, res) {
    try {
      const { page = 1, limit = 10, status, language_id, user_id } = req.query;

      let query = supabase.from("recordings").select(
        `
          *,
          prompts(text, category, difficulty),
          languages(name, iso_code),
          dialects(name),
          users(first_name, last_name)
        `,
        { count: "exact" }
      );

      if (status) {
        query = query.eq("status", status);
      }

      if (language_id) {
        query = query.eq("language_id", language_id);
      }

      if (user_id) {
        query = query.eq("user_id", user_id);
      }

      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: recordings, error, count } = await query;

      if (error) {
        logger.error("Failed to fetch recordings", { error: error.message });
        return res.status(400).json({
          success: false,
          message: "Failed to retrieve recordings",
        });
      }

      const results = await Promise.all(
        recordings.map(async (r) => {
          let download_url = null;
          try {
            if (r.file_path && r.file_path.startsWith("recordings/")) {
              download_url = await getPresignedGetUrl(r.file_path, 3600);
            }
          } catch (e) {
            // ignore
          }
          return { ...r, download_url };
        })
      );

      res.json({
        success: true,
        data: {
          recordings: results,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      logger.error("Get recordings error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to retrieve recordings",
      });
    }
  }

  static async getRecordingById(req, res) {
    try {
      const { recordingId } = req.params;

      const { data: recording, error } = await supabase
        .from("recordings")
        .select(
          `
          *,
          prompts(text, category, difficulty),
          languages(name, iso_code),
          dialects(name),
          users(first_name, last_name, country)
        `
        )
        .eq("recording_id", recordingId)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          message: "Recording not found",
        });
      }

      let download_url = null;
      try {
        if (
          recording.file_path &&
          recording.file_path.startsWith("recordings/")
        ) {
          download_url = await getPresignedGetUrl(recording.file_path, 3600);
        }
      } catch (e) {
        // ignore
      }

      res.json({
        success: true,
        data: { recording: { recording: { ...recording, download_url } } },
      });
    } catch (error) {
      logger.error("Get recording by ID error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to retrieve recording",
      });
    }
  }

  static async updateRecordingStatus(req, res) {
    try {
      const { recordingId } = req.params;
      const { status, quality_score, noise_level } = req.body;

      const updates = {
        status,
        quality_score,
        noise_level,
        updated_at: new Date(),
      };

      const { data: recording, error } = await supabase
        .from("recordings")
        .update(updates)
        .eq("recording_id", recordingId)
        .select()
        .single();

      if (error) {
        logger.error("Recording status update failed", {
          recordingId,
          error: error.message,
        });
        return res.status(400).json({
          success: false,
          message: "Failed to update recording status",
        });
      }

      logger.info("Recording status updated", { recordingId, status });

      res.json({
        success: true,
        message: "Recording status updated successfully",
        data: { recording },
      });
    } catch (error) {
      logger.error("Update recording status error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to update recording status",
      });
    }
  }
}

export default RecordingController;
