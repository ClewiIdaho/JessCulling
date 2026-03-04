import { useState } from "react";
import { open } from "@tauri-apps/api/dialog";
import { exportKeepers } from "../lib/api";

interface ExportDialogProps {
  onClose: () => void;
  onStatusMessage: (msg: string) => void;
}

function ExportDialog({ onClose, onStatusMessage }: ExportDialogProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
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
        </div>
      </div>
    </div>
  );
}

export default ExportDialog;
