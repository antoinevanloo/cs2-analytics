/**
 * Stream Utilities - Memory-efficient file handling for large demo files
 *
 * Key features:
 * - Stream-based file writing with hash calculation
 * - Parallel hash computation during write
 * - Backpressure handling for optimal memory usage
 */

import { createWriteStream, createReadStream, promises as fs } from "fs";
import { pipeline } from "stream/promises";
import { createHash, Hash } from "crypto";
import { Transform, Readable, PassThrough } from "stream";
import * as path from "path";

export interface StreamWriteResult {
  filePath: string;
  fileSize: number;
  fileHash: string;
}

/**
 * Creates a Transform stream that calculates hash while passing data through
 */
export function createHashTransform(algorithm = "sha256"): Transform & {
  getHash: () => string;
} {
  const hash: Hash = createHash(algorithm);
  let digest: string | null = null;

  const transform = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
    flush(callback) {
      digest = hash.digest("hex");
      callback();
    },
  });

  // Add method to retrieve hash after stream completes
  (transform as Transform & { getHash: () => string }).getHash = () => {
    if (!digest) {
      throw new Error("Hash not yet available - stream not finished");
    }
    return digest;
  };

  return transform as Transform & { getHash: () => string };
}

/**
 * Write a stream to file while calculating its hash
 * Memory-efficient: never loads entire file into memory
 */
export async function writeStreamWithHash(
  input: Readable,
  outputPath: string,
): Promise<StreamWriteResult> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  let fileSize = 0;
  const hashTransform = createHashTransform();

  // Transform to track file size
  const sizeTracker = new Transform({
    transform(chunk, _encoding, callback) {
      fileSize += chunk.length;
      callback(null, chunk);
    },
  });

  const writeStream = createWriteStream(outputPath);

  await pipeline(input, sizeTracker, hashTransform, writeStream);

  return {
    filePath: outputPath,
    fileSize,
    fileHash: hashTransform.getHash(),
  };
}

/**
 * Calculate hash of an existing file using streams
 */
export async function calculateFileHashStream(
  filePath: string,
): Promise<string> {
  const hash = createHash("sha256");
  const readStream = createReadStream(filePath);

  await pipeline(readStream, hash);

  return hash.digest("hex");
}

/**
 * Stream a file to FormData for multipart upload
 * Used for sending demos to the parser service
 */
export function createStreamingFormData(
  filePath: string,
  filename: string,
): {
  stream: Readable;
  contentType: string;
  getContentLength: () => Promise<number>;
} {
  const boundary = `----FormBoundary${Date.now().toString(16)}`;
  const CRLF = "\r\n";

  const header = Buffer.from(
    `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
      `Content-Type: application/octet-stream${CRLF}${CRLF}`,
  );

  const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);

  // Create a PassThrough to combine header, file, and footer
  const combined = new PassThrough();

  // Get file stats for content length calculation
  const getContentLength = async (): Promise<number> => {
    const stats = await fs.stat(filePath);
    return header.length + stats.size + footer.length;
  };

  // Start streaming asynchronously
  setImmediate(async () => {
    try {
      // Write header
      combined.write(header);

      // Stream file content
      const fileStream = createReadStream(filePath);

      fileStream.on("data", (chunk) => {
        if (!combined.write(chunk)) {
          fileStream.pause();
          combined.once("drain", () => fileStream.resume());
        }
      });

      fileStream.on("end", () => {
        combined.write(footer);
        combined.end();
      });

      fileStream.on("error", (err) => {
        combined.destroy(err);
      });
    } catch (err) {
      combined.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  });

  return {
    stream: combined,
    contentType: `multipart/form-data; boundary=${boundary}`,
    getContentLength,
  };
}

/**
 * Check if a file exists using streams-compatible async method
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file stats
 */
export async function getFileStats(
  filePath: string,
): Promise<{ size: number; mtime: Date } | null> {
  try {
    const stats = await fs.stat(filePath);
    return { size: stats.size, mtime: stats.mtime };
  } catch {
    return null;
  }
}
