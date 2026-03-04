import { useState, useEffect } from "react";
import { Photo } from "../lib/types";
import { getPhotoThumbnail } from "../lib/api";
import { isTauri } from "../lib/platform";

interface PhotoGridProps {
  photos: Photo[];
  selectedId: string | null;
  onSelect: (photo: Photo) => void;
  onStatusChange: (photoId: string, status: string) => void;
}

function PhotoCard({
  photo,
  isSelected,
  onSelect,
  onStatusChange,
}: {
  photo: Photo;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (photoId: string, status: string) => void;
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = isTauri() ? photo.file_path : photo.id;
    getPhotoThumbnail(key).then((data) => {
      if (!cancelled && data) setThumbnail(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [photo.file_path, photo.id]);

  const scoreColor =
    photo.overall_score >= 0.6
      ? "score-high"
      : photo.overall_score >= 0.35
        ? "score-medium"
        : "score-low";

  const statusClass =
    photo.status === "keep"
      ? "status-keep"
      : photo.status === "reject"
        ? "status-reject"
        : "";

  return (
    <div
      className={`photo-card ${isSelected ? "selected" : ""} ${statusClass}`}
      onClick={onSelect}
    >
      <div className="photo-thumbnail">
        {thumbnail ? (
          <img
            src={thumbnail.startsWith("data:") ? thumbnail : `data:image/jpeg;base64,${thumbnail}`}
            alt={photo.file_name}
          />
        ) : (
          <div className="thumbnail-placeholder">Loading...</div>
        )}
        <div className={`score-badge ${scoreColor}`}>
          {(photo.overall_score * 100).toFixed(0)}
        </div>
        {photo.duplicate_group && (
          <div className="duplicate-badge" title={`Duplicate group: ${photo.duplicate_group}`}>
            D
          </div>
        )}
      </div>
      <div className="photo-info">
        <span className="photo-name" title={photo.file_name}>
          {photo.file_name}
        </span>
        <div className="photo-actions">
          <button
            className={`btn-icon btn-keep ${photo.status === "keep" ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(photo.id, photo.status === "keep" ? "unreviewed" : "keep");
            }}
            title="Keep"
          >
            &#10003;
          </button>
          <button
            className={`btn-icon btn-reject ${photo.status === "reject" ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(photo.id, photo.status === "reject" ? "unreviewed" : "reject");
            }}
            title="Reject"
          >
            &#10007;
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoGrid({ photos, selectedId, onSelect, onStatusChange }: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">&#128247;</div>
        <h2>No Photos Loaded</h2>
        <p>
          {isTauri()
            ? 'Click "Import Folder" to select a folder of photos to analyze.'
            : 'Click "Select Photos" to choose images for AI analysis.'}
        </p>
        <p className="empty-formats">
          {isTauri()
            ? "Supported: JPG, PNG, TIFF, WebP, CR2, CR3, NEF, ARW, DNG, ORF, RW2, RAF"
            : "Supported: JPG, PNG, WebP, BMP"}
        </p>
      </div>
    );
  }

  return (
    <div className="photo-grid">
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          isSelected={photo.id === selectedId}
          onSelect={() => onSelect(photo)}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}

export default PhotoGrid;
