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

// Initialize S3 client for Digital Ocean Spaces
const s3Client = new S3Client({
  endpoint: spacesEndpoint,
  region: spacesRegion,
  credentials: {
    accessKeyId: spacesAccessKeyId,
    secretAccessKey: spacesSecretAccessKey,
  },
  forcePathStyle: false,
});

export interface UploadResult {
  filePath: string;
  url: string;
}

/**
 * Upload a file to Digital Ocean Spaces
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
  try {
    // Generate unique filename
    const fileExtension = path.extname(originalName);
    const fileName = `${uuidv4()}${fileExtension}`;
    const key = `${folder}/${fileName}`;

    // Upload to Digital Ocean Spaces
    const command = new PutObjectCommand({
      Bucket: spacesBucket,
      Key: key,
      Body: file,
      ACL: "public-read", // Make file publicly accessible
      ContentType: getContentType(fileExtension),
    });

    await s3Client.send(command);

    // Construct the public URL
    // Use CDN URL if provided, otherwise construct from endpoint
    const url = spacesCdnUrl
      ? `${spacesCdnUrl}/${key}`
      : `https://${spacesBucket}.${spacesRegion}.digitaloceanspaces.com/${key}`;

    return {
      filePath: key,
      url: url,
    };
  } catch (error) {
    console.error("Error uploading to Digital Ocean Spaces:", error);
    throw new Error("Failed to upload file to storage");
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
