export interface Photo {
  id: string;
  file_path: string;
  file_name: string;
  folder_path: string;
  width: number;
  height: number;
  file_size: number;
  sharpness_score: number;
  exposure_score: number;
  composition_score: number;
  face_count: number;
  eyes_open_score: number;
  overall_score: number;
  similarity_hash: string;
  status: string;
  duplicate_group: string;
  created_at: string;
}

export interface ImportResult {
  total_found: number;
  imported: number;
  failed: number;
  errors: string[];
}

export interface DuplicateGroup {
  group_id: string;
  photos: Photo[];
}

export type SortMode = "score-desc" | "score-asc" | "name-asc" | "name-desc" | "sharpness";
export type FilterMode = "all" | "keep" | "reject" | "unreviewed";
