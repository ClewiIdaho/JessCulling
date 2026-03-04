import { useState } from "react";
import { exportKeepers } from "../lib/api";
import { isTauri } from "../lib/platform";

interface ExportDialogProps {
  onClose: () => void;
  onStatusMessage: (msg: string) => void;
}

function ExportDialog({ onClose, onStatusMessage }: ExportDialogProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!isTauri()) {
      onStatusMessage("Export is only available in the desktop app.");
      onClose();
      return;
    }

    const { open } = await import("@tauri-apps/api/dialog");
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return;

    setExporting(true);
    try {
      const msg = await exportKeepers(selected);
      onStatusMessage(msg);
      onClose();
    } catch (err: any) {
      onStatusMessage(`Export error: ${err}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Export Keepers</h3>
          <button className="btn-close" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body">
          {isTauri() ? (
            <>
              <p>
                Export all photos marked as "Keep" to a destination folder.
                Original files will be copied (not moved).
              </p>
              <button
                className="btn btn-primary"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "Exporting..." : "Choose Destination & Export"}
              </button>
            </>
          ) : (
            <p>
              Export is only available in the desktop app. Download the app from
              GitHub Releases to use this feature.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExportDialog;
