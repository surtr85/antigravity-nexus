import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { logger } from "../config.js";
import type { MemoryType } from "../memory/types.js";
import { MEMORY_DIRS } from "../memory/types.js";

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug === "" ? "memory" : slug;
}

export function memoryFileName(memoryType: MemoryType, title: string, id: string): string {
  return `${slugify(title)}-${id}.md`;
}

export function memoryFilePath(root: string, memoryType: MemoryType, title: string, id: string): string {
  return path.join(root, MEMORY_DIRS[memoryType], memoryFileName(memoryType, title, id));
}

export interface AtomicWriteOptions {
  mode?: number;
}

export function atomicWriteFile(filePath: string, content: string, options: AtomicWriteOptions = {}): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`,
  );
  try {
    const fd = fs.openSync(tmpPath, "w", options.mode ?? 0o644);
    try {
      fs.writeSync(fd, content);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup failure
    }
    logger.error(`atomic write failed for ${filePath}: ${(err as Error).message}`);
    throw err;
  }
}

export function createFileExclusive(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const fd = fs.openSync(filePath, "wx", 0o644);
  try {
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
