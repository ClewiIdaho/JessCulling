import { SortMode, FilterMode } from "../lib/types";
import { isTauri } from "../lib/platform";

interface ToolbarProps {
  onImport: (pathOrFiles: string) => void;
  onAutoCull: () => void;
  onExport: () => void;
  onShowDuplicates: () => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  photoCount: number;
  loading: boolean;
  statusMessage: string;
}

function Toolbar({
  onImport,
  onAutoCull,
  onExport,
  onShowDuplicates,
  sortMode,
  onSortChange,
  filterMode,
  onFilterChange,
  photoCount,
  loading,
  statusMessage,
}: ToolbarProps) {
  const handleOpenFolder = async () => {
    if (isTauri()) {
      const { open } = await import("@tauri-apps/api/dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        onImport(selected);
      }
    } else {
      // Browser mode – file picker triggers import via api.ts
      onImport("browser");
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button
          className="btn btn-primary"
          onClick={handleOpenFolder}
          disabled={loading}
        >
          {loading ? "Processing..." : isTauri() ? "Import Folder" : "Select Photos"}
        </button>
        <button
          className="btn btn-accent"
          onClick={onAutoCull}
          disabled={loading || photoCount === 0}
        >
          Auto-Cull
        </button>
        <button
          className="btn"
          onClick={onShowDuplicates}
          disabled={photoCount === 0}
        >
          Duplicates
        </button>
        <button
          className="btn btn-success"
          onClick={onExport}
          disabled={photoCount === 0}
        >
          Export Keepers
        </button>
      </div>

      <div className="toolbar-center">
        {statusMessage && <span className="status-message">{statusMessage}</span>}
        {photoCount > 0 && (
          <span className="photo-count">{photoCount} photos</span>
        )}
      </div>

      <div className="toolbar-right">
        <select
          className="select"
          value={filterMode}
          onChange={(e) => onFilterChange(e.target.value as FilterMode)}
        >
          <option value="all">All</option>
          <option value="keep">Keepers</option>
          <option value="reject">Rejected</option>
          <option value="unreviewed">Unreviewed</option>
        </select>
        <select
          className="select"
          value={sortMode}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
        >
          <option value="score-desc">Score (High to Low)</option>
          <option value="score-asc">Score (Low to High)</option>
          <option value="sharpness">Sharpness</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
        </select>
      </div>
    </div>
  );
}

export default Toolbar;
