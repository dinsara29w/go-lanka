import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import { getServerEnv } from "@/server/env";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const PUBLIC_URL_PREFIX = "/media/";
const ALLOWED_CATEGORIES = new Set(["packages", "destinations"]);

export type UploadCategory = "packages" | "destinations";

export class ImageUploadError extends Error {
  constructor(readonly code: "invalid_type" | "too_large" | "invalid_image" | "storage") {
    super(code);
    this.name = "ImageUploadError";
  }
}

function storageRoot(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), getServerEnv().STORAGE_ROOT);
}

function publicRoot(): string {
  return path.join(storageRoot(), "public");
}

function privateRoot(): string {
  return path.join(storageRoot(), "private");
}

function assertCategory(category: string): asserts category is UploadCategory {
  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new ImageUploadError("invalid_image");
  }
}

async function processImage(
  file: File,
): Promise<{ output: Buffer; width: number; height: number }> {
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError(file.size > MAX_IMAGE_BYTES ? "too_large" : "invalid_image");
  }

  const input = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(input);
  if (!detected || !["image/jpeg", "image/png", "image/webp"].includes(detected.mime)) {
    throw new ImageUploadError("invalid_type");
  }

  try {
    const result = await sharp(input, {
      failOn: "error",
      limitInputPixels: MAX_PIXELS,
      animated: false,
    })
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return { output: result.data, width: result.info.width, height: result.info.height };
  } catch {
    throw new ImageUploadError("invalid_image");
  }
}

async function writeImage(directory: string, output: Buffer): Promise<string> {
  const filename = `${randomUUID()}.webp`;
  const finalPath = path.join(directory, filename);
  const tempPath = `${finalPath}.tmp`;

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(tempPath, output, { mode: 0o640 });
    await rename(tempPath, finalPath);
  } catch {
    await unlink(tempPath).catch(() => undefined);
    throw new ImageUploadError("storage");
  }

  return filename;
}

export async function savePublicImage(
  file: File,
  category: UploadCategory,
): Promise<{ url: string; width: number; height: number }> {
  assertCategory(category);
  const { output, width, height } = await processImage(file);
  const filename = await writeImage(path.join(publicRoot(), category), output);

  return {
    url: `${PUBLIC_URL_PREFIX}${category}/${filename}`,
    width,
    height,
  };
}

export async function savePrivatePhoto(
  file: File,
): Promise<{ path: string; width: number; height: number }> {
  const { output, width, height } = await processImage(file);
  const filename = await writeImage(path.join(privateRoot(), "submissions"), output);

  return {
    path: `submissions/${filename}`,
    width,
    height,
  };
}

export async function savePrivatePdf(buffer: Buffer): Promise<string> {
  const directory = path.join(privateRoot(), "documents");
  const filename = `${randomUUID()}.pdf`;
  const finalPath = path.join(directory, filename);
  const tempPath = `${finalPath}.tmp`;

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(tempPath, buffer, { mode: 0o640 });
    await rename(tempPath, finalPath);
  } catch {
    await unlink(tempPath).catch(() => undefined);
    throw new ImageUploadError("storage");
  }

  return `documents/${filename}`;
}

export function privateDocumentPath(relativePath: string): string | null {
  const segments = relativePath.split("/");
  if (segments.length === 0 || segments.length > 3) return null;
  if (segments.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment))) return null;
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  if (!segments.at(-1)?.toLowerCase().endsWith(".pdf")) return null;

  const root = privateRoot();
  const resolved = path.resolve(root, ...segments);
  if (!resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

export function publicMediaPath(segments: string[]): string | null {
  if (segments.length === 0 || segments.length > 3) return null;
  if (segments.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment))) return null;
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  if (!segments.at(-1)?.toLowerCase().endsWith(".webp")) return null;

  const root = publicRoot();
  const resolved = path.resolve(root, ...segments);
  if (!resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

export function privateMediaPath(relativePath: string): string | null {
  const segments = relativePath.split("/");
  if (segments.length === 0 || segments.length > 3) return null;
  if (segments.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment))) return null;
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  if (!segments.at(-1)?.toLowerCase().endsWith(".webp")) return null;

  const root = privateRoot();
  const resolved = path.resolve(root, ...segments);
  if (!resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

export async function deletePublicImage(url: string): Promise<void> {
  if (!url.startsWith(PUBLIC_URL_PREFIX)) return;
  const resolved = publicMediaPath(url.slice(PUBLIC_URL_PREFIX.length).split("/"));
  if (resolved) await unlink(resolved).catch(() => undefined);
}

export async function deletePrivatePhoto(relativePath: string): Promise<void> {
  const resolved = privateMediaPath(relativePath);
  if (resolved) await unlink(resolved).catch(() => undefined);
}

export async function deletePrivateDocument(relativePath: string): Promise<void> {
  const resolved = privateDocumentPath(relativePath);
  if (resolved) await unlink(resolved).catch(() => undefined);
}

/**
 * Reads a destination photo (a bundled /places/*.jpg or an uploaded /media/*.webp) and returns a
 * JPEG cropped to exactly width x height, for embedding in generated PDFs. Null when the file
 * is missing or unreadable, so a missing photo never blocks a quotation.
 */
export async function readImageForPdf(
  src: string | null | undefined,
  width: number,
  height: number,
): Promise<Buffer | null> {
  if (!src) return null;
  let file: string | null = null;
  const bundled = /^\/places\/([a-z0-9-]+\.jpg)$/.exec(src);
  if (bundled) {
    file = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "places", bundled[1]!);
  } else if (src.startsWith(PUBLIC_URL_PREFIX)) {
    file = publicMediaPath(src.slice(PUBLIC_URL_PREFIX.length).split("/"));
  }
  if (!file) return null;
  try {
    return await sharp(file, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width, height, fit: "cover", position: "attention" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/** The Go Lanka logo as a PNG for PDFs (rasterised from public/brand/golanka-logo.svg). */
export async function readLogoForPdf(height: number): Promise<Buffer | null> {
  try {
    return await sharp(
      path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "brand", "golanka-logo.svg"),
      { density: 300 },
    )
      .resize({ height })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}
