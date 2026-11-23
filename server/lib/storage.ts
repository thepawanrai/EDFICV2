import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
export const REPORTS_DIR = path.join(STORAGE_ROOT, 'reports');
export const EVIDENCE_DIR = path.join(STORAGE_ROOT, 'evidence');

export function ensureStorageDirectories(): void {
  try {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  } catch (err) {
    console.warn(
      'Unable to initialize storage directories at startup:',
      err instanceof Error ? err.message : err
    );
  }
}

export function isValidPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

export function isValidEvidenceBuffer(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  if (mimeType === 'application/pdf') {
    return isValidPdfBuffer(buffer);
  }
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

export function savePrivateFile(
  directory: string,
  originalExt: string,
  buffer: Buffer
): string {
  ensureStorageDirectories();
  const safeExt = originalExt.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.bin';
  const fileName = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${safeExt}`;
  const fullPath = path.join(directory, fileName);
  fs.writeFileSync(fullPath, buffer);
  return fileName;
}

export function resolvePrivateFile(directory: string, storedFileName: string): string | null {
  if (!storedFileName || storedFileName.includes('..') || /[/\\]/.test(storedFileName)) {
    return null;
  }
  const baseDir = path.resolve(directory);
  const sanitized = path.basename(storedFileName);
  const fullPath = path.resolve(baseDir, sanitized);
  if (!fullPath.startsWith(baseDir + path.sep)) return null;
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}
