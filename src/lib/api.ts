import { Photo, ImportResult, DuplicateGroup } from "./types";
import { isTauri } from "./platform";
import {
  selectFiles,
  processImages,
  getStoredPhotos,
  getThumbnail,
  updateStatus,
  autoCullPhotos,
  getDuplicates,
  exportKeptPhotos,
} from "./browser-import";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/tauri");
  return tauriInvoke<T>(cmd, args);
}

/** Select files (browser) or open folder dialog (Tauri), then score all images. */
export async function importFolder(folderPath: string): Promise<ImportResult> {
  if (!isTauri()) {
    const files = await selectFiles();
    if (files.length === 0) return { total_found: 0, imported: 0, failed: 0, errors: [] };
    return processImages(files);
  }
  return invoke<ImportResult>("import_folder", { folderPath });
}

export async function getPhotos(folderPath?: string): Promise<Photo[]> {
  if (!isTauri()) return getStoredPhotos();
  return invoke<Photo[]>("get_photos", { folderPath: folderPath ?? null });
}

export async function getPhotoThumbnail(photoId: string): Promise<string> {
  if (!isTauri()) return getThumbnail(photoId);
  return invoke<string>("get_photo_thumbnail", { filePath: photoId });
}

export async function updatePhotoStatus(
  photoId: string,
  status: string
): Promise<void> {
  if (!isTauri()) {
    updateStatus(photoId, status);
    return;
  }
  return invoke<void>("update_photo_status", { photoId, status });
}

export async function autoCull(
  keepThreshold: number,
  rejectThreshold: number
): Promise<string> {
  if (!isTauri()) return autoCullPhotos(keepThreshold, rejectThreshold);
  return invoke<string>("auto_cull", { keepThreshold, rejectThreshold });
}

export async function exportKeepers(destination: string): Promise<string> {
  if (!isTauri()) return exportKeptPhotos();
  return invoke<string>("export_keepers", { destination });
}

export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
  if (!isTauri()) return getDuplicates();
  return invoke<DuplicateGroup[]>("get_duplicate_groups");
}

export async function rescorePhoto(filePath: string): Promise<Photo> {
  return invoke<Photo>("rescore_photo", { filePath });
}
