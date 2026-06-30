import express from "express";
const router = express.Router();
import RecordingController from "../controllers/recordingController.js";
import { authenticateToken, requireContributor, } from "../middleware/authMiddleware.js";
import { validate, recordingCreateSchema, } from "../middleware/validationMiddleware.js";
import multer from "multer";

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
  },
  fileFilter: (req, file, cb) => {
    // Optional: restrict allowed MIME types
    if (!file.mimetype.startsWith("audio/")) {
      return cb(new Error("Only audio files are allowed!"), false);
    }
    cb(null, true);
  },
});

router.post("/upload-url", authenticateToken, RecordingController.getUploadUrl);

router.post(
  "/",
  authenticateToken,
  upload.single("audio"),
  validate(recordingCreateSchema),
  RecordingController.createRecording
);
router.get(
  "/",
  authenticateToken,
  requireContributor,
  RecordingController.getRecordings
);
router.get(
  "/:recordingId",
  authenticateToken,
  RecordingController.getRecordingById
);
router.put(
  "/:recordingId/status",
  authenticateToken,
  RecordingController.updateRecordingStatus
);

export default router;
