import { DuplicateGroup } from "../lib/types";

interface DuplicatePanelProps {
  groups: DuplicateGroup[];
  onClose: () => void;
  onStatusChange: (photoId: string, status: string) => void;
}

function DuplicatePanel({ groups, onClose, onStatusChange }: DuplicatePanelProps) {
  if (groups.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Duplicate Groups</h3>
            <button className="btn-close" onClick={onClose}>&#10005;</button>
          </div>
          <div className="modal-body">
            <p>No duplicate groups found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Duplicate Groups ({groups.length})</h3>
          <button className="btn-close" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body">
          <p className="dup-hint">
            Photos grouped by visual similarity. Keep the best and reject the rest.
          </p>
          {groups.map((group) => (
            <div key={group.group_id} className="dup-group">
              <h4>{group.group_id} ({group.photos.length} photos)</h4>
              <div className="dup-group-photos">
                {group.photos
                  .sort((a, b) => b.overall_score - a.overall_score)
                  .map((photo, idx) => (
                    <div
                      key={photo.id}
                      className={`dup-photo ${photo.status === "keep" ? "status-keep" : photo.status === "reject" ? "status-reject" : ""}`}
                    >
                      <div className="dup-photo-name">
                        {idx === 0 && <span className="best-badge">Best</span>}
                        {photo.file_name}
                      </div>
                      <div className="dup-photo-score">
                        Score: {(photo.overall_score * 100).toFixed(0)}%
                      </div>
                      <div className="dup-photo-actions">
                        <button
                          className={`btn-sm btn-keep ${photo.status === "keep" ? "active" : ""}`}
                          onClick={() =>
                            onStatusChange(
                              photo.id,
                              photo.status === "keep" ? "unreviewed" : "keep"
                            )
                          }
                        >
                          Keep
                        </button>
                        <button
                          className={`btn-sm btn-reject ${photo.status === "reject" ? "active" : ""}`}
                          onClick={() =>
                            onStatusChange(
                              photo.id,
                              photo.status === "reject" ? "unreviewed" : "reject"
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DuplicatePanel;
