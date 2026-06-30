// config/s3.js
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.S3_BUCKET;

if (!BUCKET) {
  throw new Error("S3_BUCKET env var is required");
}

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Uploads buffer to S3 at given key.
 * @param {Buffer} buffer
 * @param {string} key
 * @param {string} contentType
 */
async function uploadBuffer(buffer, key, contentType) {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  return s3Client.send(cmd);
}

/**
 * Generate presigned PUT URL for direct client upload
 * @param {string} key
 * @param {number} expiresIn - seconds
 * @param {string} contentType
 */
async function getPresignedPutUrl(
  key,
  contentType = "application/octet-stream",
  expiresIn = 900
) {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, cmd, { expiresIn });
}

/**
 * Generate presigned GET URL for download
 */
async function getPresignedGetUrl(key, expiresIn = 3600) {
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(s3Client, cmd, { expiresIn });
}

async function deleteFromS3(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

export { s3Client, uploadBuffer, getPresignedPutUrl, getPresignedGetUrl, deleteFromS3, BUCKET, };
