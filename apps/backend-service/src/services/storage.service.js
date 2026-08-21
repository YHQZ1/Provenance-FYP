import { supabaseAdmin } from "../config/database.js";
import fs from "fs/promises";
import path from "path";

const BUCKET_NAME = "documents";

const CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".csv": "text/csv",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".txt": "text/plain",
};

export const storageService = {
  async uploadFile(localFilePath, userId, originalName) {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const safeName = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9]/g, "_");
    const storagePath = `${userId}/${timestamp}-${safeName}${ext}`;

    const fileBuffer = await fs.readFile(localFilePath);

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType:
          CONTENT_TYPES[ext.toLowerCase()] || "application/octet-stream",
        upsert: false,
      });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    await fs.unlink(localFilePath).catch(() => {});

    return { path: storagePath };
  },

  async getSignedUrl(storagePath, expiresInSeconds = 3600) {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) throw new Error(`Failed to create signed URL: ${error.message}`);

    return data.signedUrl;
  },

  async deleteFile(storagePath) {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) throw new Error(`Failed to delete file: ${error.message}`);
  },
};
