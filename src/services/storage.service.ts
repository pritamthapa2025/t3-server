import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Digital Ocean Spaces configuration
const spacesEndpoint = process.env.DO_SPACES_ENDPOINT || "";
const spacesRegion = process.env.DO_SPACES_REGION || "nyc3";
const spacesAccessKeyId = process.env.DO_SPACES_ACCESS_KEY_ID || "";
const spacesSecretAccessKey = process.env.DO_SPACES_SECRET_ACCESS_KEY || "";
const spacesBucket = process.env.DO_SPACES_BUCKET || "";
const spacesCdnUrl = process.env.DO_SPACES_CDN_URL || "";

// Upload timeout in milliseconds (30 seconds default, configurable via env)
const UPLOAD_TIMEOUT = parseInt(process.env.DO_SPACES_UPLOAD_TIMEOUT || "30000", 10);

// Initialize S3 client for Digital Ocean Spaces
const s3Client = new S3Client({
  endpoint: spacesEndpoint,
  region: spacesRegion,
  credentials: {
    accessKeyId: spacesAccessKeyId,
    secretAccessKey: spacesSecretAccessKey,
  },
  forcePathStyle: false,
  maxAttempts: 2, // Reduce retries to fail faster
});

export interface UploadResult {
  filePath: string;
  url: string;
}

/**
 * Upload a file to Digital Ocean Spaces with timeout protection
 * @param file - The file buffer or stream
 * @param originalName - Original filename
 * @param folder - Folder path in the bucket (e.g., 'profile-pictures')
 * @returns Object containing the file path and public URL
 */
export const uploadToSpaces = async (
  file: Buffer,
  originalName: string,
  folder: string = "uploads"
): Promise<UploadResult> => {
  const startTime = Date.now();
  
  try {
    // Generate unique filename
    const fileExtension = path.extname(originalName);
    const fileName = `${uuidv4()}${fileExtension}`;
    const key = `${folder}/${fileName}`;

    // Upload to Digital Ocean Spaces with timeout
    const command = new PutObjectCommand({
      Bucket: spacesBucket,
      Key: key,
      Body: file,
      ACL: "public-read", // Make file publicly accessible
      ContentType: getContentType(fileExtension),
    });

    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, UPLOAD_TIMEOUT);

    try {
      await s3Client.send(command, { abortSignal: abortController.signal });
      clearTimeout(timeoutId);
    } catch (sendError: any) {
      clearTimeout(timeoutId);
      if (sendError.name === "AbortError" || abortController.signal.aborted) {
        const elapsed = Date.now() - startTime;
        console.error(`Upload timeout after ${elapsed}ms for file: ${originalName}`);
        throw new Error(`Upload timeout: File upload exceeded ${UPLOAD_TIMEOUT}ms limit`);
      }
      throw sendError;
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ File uploaded successfully in ${elapsed}ms: ${key}`);

    // Construct the public URL
    // Use CDN URL if provided, otherwise construct from endpoint
    const url = spacesCdnUrl
      ? `${spacesCdnUrl}/${key}`
      : `https://${spacesBucket}.${spacesRegion}.digitaloceanspaces.com/${key}`;

    return {
      filePath: key,
      url: url,
    };
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Error uploading to Digital Ocean Spaces after ${elapsed}ms:`, error);
    
    // Provide more specific error messages
    if (error.message?.includes("timeout")) {
      throw new Error(`File upload timed out after ${UPLOAD_TIMEOUT}ms. Please try again or use a smaller file.`);
    }
    if (error.name === "TimeoutError" || error.code === "ETIMEDOUT") {
      throw new Error(`Connection timeout while uploading file. Please check your network connection.`);
    }
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      throw new Error(`Cannot connect to storage service. Please check configuration.`);
    }
    
    throw new Error(error.message || "Failed to upload file to storage");
  }
};

/**
 * Get content type based on file extension
 */
const getContentType = (extension: string): string => {
  const contentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  return contentTypes[extension.toLowerCase()] || "application/octet-stream";
};

/**
 * Delete a file from Digital Ocean Spaces
 * @param fileUrl - Full URL of the file to delete
 * @returns Promise<boolean> - Success status
 */
export const deleteFromSpaces = async (fileUrl: string): Promise<boolean> => {
  try {
    if (!fileUrl) {
      return true; // Nothing to delete
    }

    // Extract key from URL
    const key = extractKeyFromUrl(fileUrl);
    if (!key) {
      console.warn("Could not extract key from URL:", fileUrl);
      return false;
    }

    // Delete from Digital Ocean Spaces
    const command = new DeleteObjectCommand({
      Bucket: spacesBucket,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`✅ File deleted from DigitalOcean Spaces: ${key}`);
    return true;
  } catch (error) {
    console.error("❌ Error deleting from DigitalOcean Spaces:", error);
    return false;
  }
};

/**
 * Extract file key from full URL
 * @param url - Full URL (e.g., "https://cdn.example.com/folder/file.jpg")
 * @returns Key (e.g., "folder/file.jpg")
 */
const extractKeyFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // Remove leading slash if present
    return pathname.startsWith('/') ? pathname.substring(1) : pathname;
  } catch (error) {
    console.error("Error extracting key from URL:", error);
    return null;
  }
};
