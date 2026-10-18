/**
 * Client-side Image Compression Utility
 * 
 * Compresses images in the browser using HTML5 Canvas prior to uploading
 * to Supabase Storage or saving base64 representations in the database.
 * 
 * Benefits:
 * - Reduces 5MB-15MB smartphone photos down to ~150KB-350KB (up to 95%+ reduction)
 * - Drastically speeds up uploads on field mobile / cellular connections
 * - Prevents storage quota depletion and database row bloat
 * - Preserves sharp visual quality for store audit & evidence verification
 */

export interface ImageCompressionOptions {
  /** Maximum width in pixels (aspect ratio is preserved). Defaults to 1600. */
  maxWidth?: number;
  /** Maximum height in pixels (aspect ratio is preserved). Defaults to 1600. */
  maxHeight?: number;
  /** Compression quality between 0.0 and 1.0. Defaults to 0.80. */
  quality?: number;
  /** Output MIME type. Defaults to 'image/jpeg'. */
  mimeType?: string;
  /** Optional max file size in Megabytes. Defaults to 1.5MB target. */
  maxSizeMB?: number;
}

export interface CompressionResult {
  /** The compressed File object ready for upload */
  file: File;
  /** Compressed Blob */
  blob: Blob;
  /** Original file size in bytes */
  originalSize: number;
  /** Compressed file size in bytes */
  compressedSize: number;
  /** Percentage of bytes saved (0 to 100) */
  savingsPercent: number;
  /** Resulting image width */
  width: number;
  /** Resulting image height */
  height: number;
}

/** Formats byte counts into human-readable strings (e.g., "4.2 MB", "230 KB") */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Loads an image File/Blob into an HTMLImageElement safely.
 */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image for compression: ${err}`));
    };

    img.src = url;
  });
}

/**
 * Calculates new dimensions that fit within maxWidth/maxHeight while preserving aspect ratio.
 */
function calculateDimensions(
  origW: number,
  origH: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  let width = origW;
  let height = origH;

  if (width > maxW || height > maxH) {
    const ratio = Math.min(maxW / width, maxH / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Ensure minimum dimensions
  width = Math.max(1, width);
  height = Math.max(1, height);

  return { width, height };
}

/**
 * Compresses an image File or Blob with detailed compression statistics.
 */
export async function compressImageWithStats(
  file: File | Blob,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  const originalSize = file.size;

  // Defaults optimized for mobile field audits & photo proofs
  const maxWidth = options.maxWidth ?? 1600;
  const maxHeight = options.maxHeight ?? 1600;
  const quality = options.quality ?? 0.8;
  const mimeType = options.mimeType ?? "image/jpeg";
  const originalName = file instanceof File ? file.name : "photo.jpg";

  // If already a tiny file (e.g. < 60KB) and not oversized dimensions, avoid redundant processing
  if (originalSize < 60 * 1024 && file instanceof File) {
    return {
      file,
      blob: file,
      originalSize,
      compressedSize: originalSize,
      savingsPercent: 0,
      width: 0,
      height: 0,
    };
  }

  try {
    const img = await loadImage(file);
    const { width, height } = calculateDimensions(img.naturalWidth, img.naturalHeight, maxWidth, maxHeight);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create canvas 2D rendering context");
    }

    // If exporting to JPEG, paint clean white background for transparency safety
    if (mimeType === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    // Initial compression
    let compressedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas toBlob conversion failed"));
        },
        mimeType,
        quality
      );
    });

    // Adaptive pass if file still exceeds maxSizeMB
    const targetMaxBytes = (options.maxSizeMB ?? 1.5) * 1024 * 1024;
    if (compressedBlob.size > targetMaxBytes && quality > 0.5) {
      const lowerQuality = Math.max(0.5, quality - 0.25);
      const secondPassBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), mimeType, lowerQuality);
      });
      if (secondPassBlob && secondPassBlob.size < compressedBlob.size) {
        compressedBlob = secondPassBlob;
      }
    }

    // If compression somehow produced a larger file than original (e.g. tiny low-res PNG re-encoded),
    // keep the original
    if (file instanceof File && compressedBlob.size >= originalSize) {
      return {
        file,
        blob: file,
        originalSize,
        compressedSize: originalSize,
        savingsPercent: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    }

    // Generate output file name with .jpg or .webp
    const baseName = originalName.replace(/\.[^/.]+$/, "");
    const ext = mimeType === "image/webp" ? ".webp" : ".jpg";
    const compressedFileName = `${baseName}${ext}`;

    const compressedFile = new File([compressedBlob], compressedFileName, {
      type: mimeType,
      lastModified: Date.now(),
    });

    const compressedSize = compressedFile.size;
    const savingsPercent = originalSize > 0
      ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
      : 0;

    return {
      file: compressedFile,
      blob: compressedBlob,
      originalSize,
      compressedSize,
      savingsPercent,
      width,
      height,
    };
  } catch (error) {
    console.warn("Image compression encountered an error; using original file:", error);
    const fallbackFile = file instanceof File ? file : new File([file], originalName, { type: file.type || "image/jpeg" });
    return {
      file: fallbackFile,
      blob: file,
      originalSize,
      compressedSize: originalSize,
      savingsPercent: 0,
      width: 0,
      height: 0,
    };
  }
}

/**
 * Convenience method that returns just the compressed File.
 */
export async function compressImage(
  file: File | Blob,
  options?: ImageCompressionOptions
): Promise<File> {
  const result = await compressImageWithStats(file, options);
  return result.file;
}

/**
 * Compresses an image and returns a compact Data URL string (ideal for user avatars in database).
 */
export async function compressImageToDataUrl(
  file: File | Blob,
  options: ImageCompressionOptions = { maxWidth: 512, maxHeight: 512, quality: 0.8 }
): Promise<{ dataUrl: string; originalSize: number; compressedSize: number; savingsPercent: number }> {
  const result = await compressImageWithStats(file, options);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve({
          dataUrl: reader.result,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          savingsPercent: result.savingsPercent,
        });
      } else {
        reject(new Error("FileReader result is not a string"));
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(result.blob);
  });
}
