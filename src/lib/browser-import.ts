/**
 * Browser-side image import, scoring, and export.
 * Uses HTML5 File API + Canvas for image processing.
 */

import { Photo, ImportResult, DuplicateGroup } from "./types";
import {
  sharpnessScore,
  exposureScore,
  compositionScore,
  detectFaces,
  perceptualHash,
  overallScore,
  groupDuplicates,
  hashDistance,
} from "./scoring";

// In-memory state
let photoStore: Photo[] = [];
const thumbnailCache = new Map<string, string>();
const fileCache = new Map<string, File>();

const ANALYSIS_MAX = 800; // Max dimension for scoring (speed)
const THUMB_MAX = 300;

/** Prompt user to select image files. Returns chosen files. */
export function selectFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);

    input.addEventListener("change", () => {
      const files = input.files ? Array.from(input.files) : [];
      document.body.removeChild(input);
      resolve(files);
    });

    // Handle cancel (no files selected)
    input.addEventListener("cancel", () => {
      document.body.removeChild(input);
      resolve([]);
    });

    input.click();
  });
}

/** Load an image file into an HTMLImageElement. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load: ${file.name}`));
    };
    img.src = url;
  });
}

/** Draw image to canvas at target size, return ImageData. */
function getImageData(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  maxSize: number
): { data: ImageData; w: number; h: number } {
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (w > maxSize || h > maxSize) {
    const scale = maxSize / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h), w, h };
}

/** Generate a base64 thumbnail. */
function makeThumbnail(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  maxSize: number
): string {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const scale = maxSize / Math.max(w, h);
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** Process a single image file: score it and generate thumbnail. */
async function processOne(
  file: File,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<Photo> {
  const img = await loadImage(file);
  const id = crypto.randomUUID();

  // Score at reduced resolution
  const { data: imgData, w, h } = getImageData(canvas, ctx, img, ANALYSIS_MAX);
  const pixels = imgData.data;

  const sharpness = sharpnessScore(pixels, w, h);
  const exposure = exposureScore(pixels, w, h);
  const composition = compositionScore(pixels, w, h);
  const [faceCount, eyesOpen] = detectFaces(pixels, w, h);
  const overall = overallScore(sharpness, exposure, composition, faceCount, eyesOpen);
  const phash = perceptualHash(canvas, img);

  // Generate thumbnail
  const thumbDataUrl = makeThumbnail(canvas, ctx, img, THUMB_MAX);
  thumbnailCache.set(id, thumbDataUrl);
  fileCache.set(id, file);

  return {
    id,
    file_path: file.name,
    file_name: file.name,
    folder_path: "browser-upload",
    width: img.naturalWidth,
    height: img.naturalHeight,
    file_size: file.size,
    sharpness_score: sharpness,
    exposure_score: exposure,
    composition_score: composition,
    face_count: faceCount,
    eyes_open_score: eyesOpen,
    overall_score: overall,
    similarity_hash: phash,
    status: "unreviewed",
    duplicate_group: "",
    created_at: new Date().toISOString(),
  };
}

/** Import files: score all and run duplicate grouping. */
export async function processImages(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<ImportResult> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const imported: Photo[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    try {
      const photo = await processOne(files[i], canvas, ctx);
      imported.push(photo);
    } catch (e: any) {
      errors.push(`${files[i].name}: ${e.message || e}`);
    }
    onProgress?.(i + 1, files.length);
  }

  // Duplicate grouping
  const hashPairs = imported.map((p) => ({ id: p.id, hash: p.similarity_hash }));
  const groups = groupDuplicates(hashPairs, 10);
  for (const photo of imported) {
    const groupId = groups.get(photo.id);
    if (groupId) photo.duplicate_group = groupId;
  }

  photoStore = imported;

  return {
    total_found: files.length,
    imported: imported.length,
    failed: errors.length,
    errors,
  };
}

/** Get all stored photos. */
export function getStoredPhotos(): Photo[] {
  return photoStore.map((p) => ({ ...p }));
}

/** Get thumbnail data URL for a photo. */
export function getThumbnail(photoId: string): string {
  return thumbnailCache.get(photoId) ?? "";
}

/** Update a photo's status in memory. */
export function updateStatus(photoId: string, status: string): void {
  const photo = photoStore.find((p) => p.id === photoId);
  if (photo) photo.status = status;
}

/** Auto-cull photos by score thresholds. */
export function autoCullPhotos(
  keepThreshold: number,
  rejectThreshold: number
): string {
  let kept = 0;
  let rejected = 0;
  for (const p of photoStore) {
    if (p.overall_score >= keepThreshold) {
      p.status = "keep";
      kept++;
    } else if (p.overall_score < rejectThreshold) {
      p.status = "reject";
      rejected++;
    }
  }
  return `Auto-cull complete: ${kept} kept, ${rejected} rejected, ${photoStore.length - kept - rejected} unreviewed`;
}

/** Get duplicate groups from stored photos. */
export function getDuplicates(): DuplicateGroup[] {
  const groups: Record<string, Photo[]> = {};
  for (const p of photoStore) {
    if (p.duplicate_group) {
      if (!groups[p.duplicate_group]) groups[p.duplicate_group] = [];
      groups[p.duplicate_group].push({ ...p });
    }
  }
  return Object.entries(groups)
    .map(([group_id, photos]) => ({ group_id, photos }))
    .sort((a, b) => a.group_id.localeCompare(b.group_id));
}

/** Export kept photos as a downloadable zip (lightweight, no dependencies). */
export async function exportKeptPhotos(): Promise<string> {
  const keepers = photoStore.filter((p) => p.status === "keep");
  if (keepers.length === 0) return "No photos marked as keepers.";

  // Collect original files
  const filesToExport: { name: string; file: File }[] = [];
  for (const p of keepers) {
    const file = fileCache.get(p.id);
    if (file) filesToExport.push({ name: p.file_name, file });
  }

  if (filesToExport.length === 0) return "Original files not available.";

  if (filesToExport.length === 1) {
    // Single file: direct download
    const { name, file } = filesToExport[0];
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return `Downloaded ${name}`;
  }

  // Multiple files: download each individually
  // (A real zip library would be better, but we avoid adding dependencies)
  for (const { name, file } of filesToExport) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    // Small delay between downloads so browser doesn't block them
    await new Promise((r) => setTimeout(r, 200));
  }
  return `Downloaded ${filesToExport.length} photos`;
}
