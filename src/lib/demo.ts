import { Photo, ImportResult, DuplicateGroup } from "./types";

const DEMO_PHOTOS: Photo[] = [
  {
    id: "demo-1",
    file_path: "/demo/IMG_0421.jpg",
    file_name: "IMG_0421.jpg",
    folder_path: "/demo",
    width: 6000,
    height: 4000,
    file_size: 8_420_000,
    sharpness_score: 0.82,
    exposure_score: 0.75,
    composition_score: 0.68,
    face_count: 1,
    eyes_open_score: 0.9,
    overall_score: 0.79,
    similarity_hash: "a0a0a0a0",
    status: "unreviewed",
    duplicate_group: "",
    created_at: "2026-03-01T10:00:00",
  },
  {
    id: "demo-2",
    file_path: "/demo/IMG_0422.jpg",
    file_name: "IMG_0422.jpg",
    folder_path: "/demo",
    width: 6000,
    height: 4000,
    file_size: 7_150_000,
    sharpness_score: 0.91,
    exposure_score: 0.88,
    composition_score: 0.72,
    face_count: 2,
    eyes_open_score: 0.85,
    overall_score: 0.87,
    similarity_hash: "b1b1b1b1",
    status: "unreviewed",
    duplicate_group: "",
    created_at: "2026-03-01T10:01:00",
  },
  {
    id: "demo-3",
    file_path: "/demo/IMG_0423.jpg",
    file_name: "IMG_0423.jpg",
    folder_path: "/demo",
    width: 6000,
    height: 4000,
    file_size: 9_300_000,
    sharpness_score: 0.35,
    exposure_score: 0.42,
    composition_score: 0.55,
    face_count: 0,
    eyes_open_score: 0.0,
    overall_score: 0.38,
    similarity_hash: "c2c2c2c2",
    status: "unreviewed",
    duplicate_group: "",
    created_at: "2026-03-01T10:02:00",
  },
  {
    id: "demo-4",
    file_path: "/demo/IMG_0424.jpg",
    file_name: "IMG_0424.jpg",
    folder_path: "/demo",
    width: 4000,
    height: 6000,
    file_size: 6_800_000,
    sharpness_score: 0.15,
    exposure_score: 0.22,
    composition_score: 0.30,
    face_count: 1,
    eyes_open_score: 0.3,
    overall_score: 0.21,
    similarity_hash: "d3d3d3d3",
    status: "unreviewed",
    duplicate_group: "",
    created_at: "2026-03-01T10:03:00",
  },
  {
    id: "demo-5",
    file_path: "/demo/IMG_0425.jpg",
    file_name: "IMG_0425.jpg",
    folder_path: "/demo",
    width: 6000,
    height: 4000,
    file_size: 7_600_000,
    sharpness_score: 0.78,
    exposure_score: 0.81,
    composition_score: 0.90,
    face_count: 0,
    eyes_open_score: 0.0,
    overall_score: 0.76,
    similarity_hash: "a0a0a0a1",
    status: "unreviewed",
    duplicate_group: "group_1",
    created_at: "2026-03-01T10:04:00",
  },
  {
    id: "demo-6",
    file_path: "/demo/IMG_0426.jpg",
    file_name: "IMG_0426.jpg",
    folder_path: "/demo",
    width: 6000,
    height: 4000,
    file_size: 7_900_000,
    sharpness_score: 0.72,
    exposure_score: 0.79,
    composition_score: 0.85,
    face_count: 0,
    eyes_open_score: 0.0,
    overall_score: 0.73,
    similarity_hash: "a0a0a0a2",
    status: "unreviewed",
    duplicate_group: "group_1",
    created_at: "2026-03-01T10:05:00",
  },
  {
    id: "demo-7",
    file_path: "/demo/IMG_0427.jpg",
    file_name: "IMG_0427.jpg",
    folder_path: "/demo",
    width: 6000,
    height: 4000,
    file_size: 5_200_000,
    sharpness_score: 0.65,
    exposure_score: 0.70,
    composition_score: 0.60,
    face_count: 3,
    eyes_open_score: 0.65,
    overall_score: 0.66,
    similarity_hash: "e4e4e4e4",
    status: "unreviewed",
    duplicate_group: "",
    created_at: "2026-03-01T10:06:00",
  },
  {
    id: "demo-8",
    file_path: "/demo/IMG_0428.jpg",
    file_name: "IMG_0428.jpg",
    folder_path: "/demo",
    width: 6000,
    height: 4000,
    file_size: 8_100_000,
    sharpness_score: 0.55,
    exposure_score: 0.48,
    composition_score: 0.52,
    face_count: 0,
    eyes_open_score: 0.0,
    overall_score: 0.50,
    similarity_hash: "f5f5f5f5",
    status: "unreviewed",
    duplicate_group: "",
    created_at: "2026-03-01T10:07:00",
  },
];

let demoState = DEMO_PHOTOS.map((p) => ({ ...p }));

export function getDemoPhotos(): Photo[] {
  return demoState.map((p) => ({ ...p }));
}

export function demoimportFolder(): ImportResult {
  demoState = DEMO_PHOTOS.map((p) => ({ ...p }));
  return {
    total_found: demoState.length,
    imported: demoState.length,
    failed: 0,
    errors: [],
  };
}

export function demoUpdateStatus(photoId: string, status: string): void {
  const photo = demoState.find((p) => p.id === photoId);
  if (photo) photo.status = status;
}

export function demoAutoCull(
  keepThreshold: number,
  rejectThreshold: number
): string {
  let kept = 0;
  let rejected = 0;
  for (const p of demoState) {
    if (p.overall_score >= keepThreshold) {
      p.status = "keep";
      kept++;
    } else if (p.overall_score < rejectThreshold) {
      p.status = "reject";
      rejected++;
    }
  }
  return `Auto-cull complete: ${kept} kept, ${rejected} rejected, ${demoState.length - kept - rejected} unreviewed`;
}

export function getDemoDuplicateGroups(): DuplicateGroup[] {
  const groups: Record<string, Photo[]> = {};
  for (const p of demoState) {
    if (p.duplicate_group) {
      if (!groups[p.duplicate_group]) groups[p.duplicate_group] = [];
      groups[p.duplicate_group].push({ ...p });
    }
  }
  return Object.entries(groups).map(([group_id, photos]) => ({
    group_id,
    photos,
  }));
}
