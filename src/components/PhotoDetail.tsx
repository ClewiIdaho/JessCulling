import { useState, useEffect } from "react";
import { Photo } from "../lib/types";
import { getPhotoThumbnail } from "../lib/api";
import { isTauri } from "../lib/platform";

interface PhotoDetailProps {
  photo: Photo;
  onStatusChange: (photoId: string, status: string) => void;
  onClose: () => void;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 60 ? "#2e7d32" : pct >= 35 ? "#f57c00" : "#c62828";
  return (
    <div className="score-bar">
      <div className="score-bar-label">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function PhotoDetail({ photo, onStatusChange, onClose }: PhotoDetailProps) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    getPhotoThumbnail(photo.file_path).then((data) => {
      if (!cancelled) setPreview(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [photo.file_path]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="photo-detail">
      <div className="detail-header">
        <h3>{photo.file_name}</h3>
        <button className="btn-close" onClick={onClose}>
          &#10005;
        </button>
      </div>

      <div className="detail-preview">
        {preview ? (
          <img src={`data:image/jpeg;base64,${preview}`} alt={photo.file_name} />
        ) : (
          <div className="thumbnail-placeholder" style={{ background: "#e8e8e8" }}>
            {isTauri() ? "Loading preview..." : photo.file_name}
          </div>
        )}
      </div>

      <div className="detail-meta">
        <span>
          {photo.width} &times; {photo.height}
        </span>
        <span>{formatSize(photo.file_size)}</span>
        {photo.face_count > 0 && (
          <span>
            {photo.face_count} face{photo.face_count !== 1 ? "s" : ""}
          </span>
        )}
        {photo.duplicate_group && (
          <span className="dup-label">{photo.duplicate_group}</span>
        )}
      </div>

      <div className="detail-scores">
        <h4>AI Scores</h4>
        <ScoreBar label="Overall" value={photo.overall_score} />
        <ScoreBar label="Sharpness" value={photo.sharpness_score} />
        <ScoreBar label="Exposure" value={photo.exposure_score} />
        <ScoreBar label="Composition" value={photo.composition_score} />
        {photo.face_count > 0 && (
          <ScoreBar label="Eyes Open" value={photo.eyes_open_score} />
        )}
      </div>

      <div className="detail-actions">
        <button
          className={`btn btn-keep-large ${photo.status === "keep" ? "active" : ""}`}
          onClick={() =>
            onStatusChange(photo.id, photo.status === "keep" ? "unreviewed" : "keep")
          }
        >
          {photo.status === "keep" ? "Kept" : "Keep"}
        </button>
        <button
          className={`btn btn-reject-large ${photo.status === "reject" ? "active" : ""}`}
          onClick={() =>
            onStatusChange(
              photo.id,
              photo.status === "reject" ? "unreviewed" : "reject"
            )
          }
        >
          {photo.status === "reject" ? "Rejected" : "Reject"}
        </button>
      </div>
    </div>
  );
}

export default PhotoDetail;
