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
    setExporting(true);
    try {
      if (isTauri()) {
        const { open } = await import("@tauri-apps/api/dialog");
        const selected = await open({ directory: true, multiple: false });
        if (!selected || typeof selected !== "string") {
          setExporting(false);
          return;
        }
        const msg = await exportKeepers(selected);
        onStatusMessage(msg);
      } else {
        const msg = await exportKeepers("");
        onStatusMessage(msg);
      }
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
          <p>
            {isTauri()
              ? 'Export all photos marked as "Keep" to a destination folder. Original files will be copied (not moved).'
              : 'Download all photos marked as "Keep" to your device.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting
              ? "Exporting..."
              : isTauri()
                ? "Choose Destination & Export"
                : "Download Keepers"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportDialog;
