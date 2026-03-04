import { invoke } from "@tauri-apps/api/tauri";
import { Photo, ImportResult, DuplicateGroup } from "./types";

export async function importFolder(folderPath: string): Promise<ImportResult> {
  return invoke<ImportResult>("import_folder", { folderPath });
}

export async function getPhotos(folderPath?: string): Promise<Photo[]> {
  return invoke<Photo[]>("get_photos", { folderPath: folderPath ?? null });
}

export async function getPhotoThumbnail(filePath: string): Promise<string> {
  return invoke<string>("get_photo_thumbnail", { filePath });
}

export async function updatePhotoStatus(
  photoId: string,
  status: string
): Promise<void> {
  return invoke<void>("update_photo_status", { photoId, status });
}

export async function autoCull(
  keepThreshold: number,
  rejectThreshold: number
): Promise<string> {
  return invoke<string>("auto_cull", { keepThreshold, rejectThreshold });
}

export async function exportKeepers(destination: string): Promise<string> {
  return invoke<string>("export_keepers", { destination });
}

export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
  return invoke<DuplicateGroup[]>("get_duplicate_groups");
}

export async function rescorePhoto(filePath: string): Promise<Photo> {
  return invoke<Photo>("rescore_photo", { filePath });
}
