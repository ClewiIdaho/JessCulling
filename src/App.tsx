import { useState, useCallback } from "react";
import Header from "./components/Header";
import Toolbar from "./components/Toolbar";
import PhotoGrid from "./components/PhotoGrid";
import PhotoDetail from "./components/PhotoDetail";
import DuplicatePanel from "./components/DuplicatePanel";
import ExportDialog from "./components/ExportDialog";
import { Photo, SortMode, FilterMode, DuplicateGroup } from "./lib/types";
import {
  importFolder,
  getPhotos,
  updatePhotoStatus,
  autoCull,
  getDuplicateGroups,
} from "./lib/api";

function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("score-desc");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentFolder, setCurrentFolder] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);

  const handleImport = useCallback(async (folderPath: string) => {
    setLoading(true);
    setStatusMessage("Importing and analyzing photos...");
    try {
      const result = await importFolder(folderPath);
      setStatusMessage(
        `Imported ${result.imported} of ${result.total_found} photos` +
          (result.failed > 0 ? ` (${result.failed} failed)` : "")
      );
      setCurrentFolder(folderPath);
      const allPhotos = await getPhotos(folderPath);
      setPhotos(allPhotos);
    } catch (err: any) {
      setStatusMessage(`Import error: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStatusChange = useCallback(
    async (photoId: string, status: string) => {
      try {
        await updatePhotoStatus(photoId, status);
        setPhotos((prev) =>
          prev.map((p) => (p.id === photoId ? { ...p, status } : p))
        );
        if (selectedPhoto?.id === photoId) {
          setSelectedPhoto((prev) => (prev ? { ...prev, status } : null));
        }
      } catch (err: any) {
        setStatusMessage(`Error: ${err}`);
      }
    },
    [selectedPhoto]
  );

  const handleAutoCull = useCallback(async () => {
    setLoading(true);
    setStatusMessage("Running auto-cull...");
    try {
      const msg = await autoCull(0.55, 0.3);
      setStatusMessage(msg);
      if (currentFolder) {
        const allPhotos = await getPhotos(currentFolder);
        setPhotos(allPhotos);
      }
    } catch (err: any) {
      setStatusMessage(`Auto-cull error: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [currentFolder]);

  const handleShowDuplicates = useCallback(async () => {
    try {
      const groups = await getDuplicateGroups();
      setDuplicateGroups(groups);
      setShowDuplicates(true);
    } catch (err: any) {
      setStatusMessage(`Error loading duplicates: ${err}`);
    }
  }, []);

  const sortedAndFiltered = (() => {
    let result = [...photos];

    // Filter
    if (filterMode === "keep") result = result.filter((p) => p.status === "keep");
    else if (filterMode === "reject") result = result.filter((p) => p.status === "reject");
    else if (filterMode === "unreviewed") result = result.filter((p) => p.status === "unreviewed");

    // Sort
    switch (sortMode) {
      case "score-desc":
        result.sort((a, b) => b.overall_score - a.overall_score);
        break;
      case "score-asc":
        result.sort((a, b) => a.overall_score - b.overall_score);
        break;
      case "name-asc":
        result.sort((a, b) => a.file_name.localeCompare(b.file_name));
        break;
      case "name-desc":
        result.sort((a, b) => b.file_name.localeCompare(a.file_name));
        break;
      case "sharpness":
        result.sort((a, b) => b.sharpness_score - a.sharpness_score);
        break;
    }

    return result;
  })();

  return (
    <div className="app">
      <Header />
      <Toolbar
        onImport={handleImport}
        onAutoCull={handleAutoCull}
        onExport={() => setShowExport(true)}
        onShowDuplicates={handleShowDuplicates}
        sortMode={sortMode}
        onSortChange={setSortMode}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
        photoCount={photos.length}
        loading={loading}
        statusMessage={statusMessage}
      />
      <div className="main-content">
        <PhotoGrid
          photos={sortedAndFiltered}
          selectedId={selectedPhoto?.id ?? null}
          onSelect={setSelectedPhoto}
          onStatusChange={handleStatusChange}
        />
        {selectedPhoto && (
          <PhotoDetail
            photo={selectedPhoto}
            onStatusChange={handleStatusChange}
            onClose={() => setSelectedPhoto(null)}
          />
        )}
      </div>
      {showExport && (
        <ExportDialog
          onClose={() => setShowExport(false)}
          onStatusMessage={setStatusMessage}
        />
      )}
      {showDuplicates && (
        <DuplicatePanel
          groups={duplicateGroups}
          onClose={() => setShowDuplicates(false)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

export default App;
