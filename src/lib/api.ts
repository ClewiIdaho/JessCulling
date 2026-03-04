import { Photo, ImportResult, DuplicateGroup } from "./types";
import { isTauri } from "./platform";
import {
  getDemoPhotos,
  demoimportFolder,
  demoUpdateStatus,
  demoAutoCull,
  getDemoDuplicateGroups,
} from "./demo";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/tauri");
  return tauriInvoke<T>(cmd, args);
}

export async function importFolder(folderPath: string): Promise<ImportResult> {
  if (!isTauri()) return demoimportFolder();
  return invoke<ImportResult>("import_folder", { folderPath });
}

export async function getPhotos(folderPath?: string): Promise<Photo[]> {
  if (!isTauri()) return getDemoPhotos();
  return invoke<Photo[]>("get_photos", { folderPath: folderPath ?? null });
}

export async function getPhotoThumbnail(filePath: string): Promise<string> {
  if (!isTauri()) return "";
  return invoke<string>("get_photo_thumbnail", { filePath });
}

export async function updatePhotoStatus(
  photoId: string,
  status: string
): Promise<void> {
  if (!isTauri()) {
    demoUpdateStatus(photoId, status);
    return;
  }
  return invoke<void>("update_photo_status", { photoId, status });
}

export async function autoCull(
  keepThreshold: number,
  rejectThreshold: number
): Promise<string> {
  if (!isTauri()) return demoAutoCull(keepThreshold, rejectThreshold);
  return invoke<string>("auto_cull", { keepThreshold, rejectThreshold });
}

export async function exportKeepers(destination: string): Promise<string> {
  if (!isTauri()) return "Export is only available in the desktop app.";
  return invoke<string>("export_keepers", { destination });
}

export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
  if (!isTauri()) return getDemoDuplicateGroups();
  return invoke<DuplicateGroup[]>("get_duplicate_groups");
}

export async function rescorePhoto(filePath: string): Promise<Photo> {
  return invoke<Photo>("rescore_photo", { filePath });
}
