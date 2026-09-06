/**
 * lib/storage/index.ts
 *
 * File storage abstraction.
 * Default: local filesystem (./data/uploads/).
 * Swappable to S3/Azure Blob by implementing StorageAdapter.
 *
 * In production, UPLOAD_DIR should point to a Docker volume mount.
 */

import { mkdir, writeFile, readFile, unlink, stat } from "fs/promises";
import { join, basename } from "path";
import { randomUUID } from "crypto";
import { UPLOAD_DIR } from "@/lib/brain/config";

// ── Interface ──────────────────────────────────────────────────────────

export interface StorageAdapter {
  /** Save a file and return its storage path (key). */
  save(
    fileName: string,
    data: Buffer,
    mimeType: string,
  ): Promise<{ storagePath: string; sizeBytes: number }>;

  /** Read a file by its storage path. */
  read(storagePath: string): Promise<Buffer>;

  /** Delete a file by its storage path. */
  delete(storagePath: string): Promise<void>;

  /** Check if a file exists. */
  exists(storagePath: string): Promise<boolean>;
}

// ── Local filesystem adapter ───────────────────────────────────────────

class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private async ensureDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true });
  }

  async save(
    fileName: string,
    data: Buffer,
    mimeType: string,
  ): Promise<{ storagePath: string; sizeBytes: number }> {
    void mimeType;
    // Organize by date: data/uploads/2026/09/03/<uuid>-<filename>
    const now = new Date();
    const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
    const dir = join(this.baseDir, datePath);
    await this.ensureDir(dir);

    const safeFileName = basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${randomUUID().slice(0, 8)}-${safeFileName}`;
    const fullPath = join(dir, key);

    await writeFile(fullPath, data);

    return {
      storagePath: join(datePath, key), // relative to baseDir
      sizeBytes: data.length,
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    return readFile(join(this.baseDir, storagePath));
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await unlink(join(this.baseDir, storagePath));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await stat(join(this.baseDir, storagePath));
      return true;
    } catch {
      return false;
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

const globalForStorage = global as typeof globalThis & {
  storage?: StorageAdapter;
};

export const storage: StorageAdapter =
  globalForStorage.storage ??
  (globalForStorage.storage = new LocalStorageAdapter(UPLOAD_DIR));
