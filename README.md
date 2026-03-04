# Jess Helm Photography – AI Photo Culling

A lightweight, **local-only** desktop app that lets photographers drag in a folder of images and automatically cull them using on-device AI. No cloud services, no API keys – everything runs offline on your machine.

## Features

- **Folder Import** – Load JPG, PNG, TIFF, WebP, and RAW files (CR2, CR3, NEF, ARW, DNG, ORF, RW2, RAF)
- **AI Scoring Pipeline** (all local, no internet required):
  - **Sharpness/Blur Detection** – Laplacian variance analysis
  - **Face Detection** – Skin-color heuristic with connected-component analysis
  - **Eyes-Open Scoring** – Contrast-based heuristic for detected faces
  - **Exposure Analysis** – Histogram-based over/under exposure detection
  - **Composition Heuristics** – Rule-of-thirds edge energy analysis
  - **Duplicate Grouping** – Perceptual hash (aHash) similarity clustering
- **Interactive UI**:
  - Thumbnail grid with color-coded quality scores
  - Sort by score, sharpness, or filename
  - Filter by status (all, keep, reject, unreviewed)
  - One-click keep/reject per photo
  - Detailed score breakdown panel
  - Duplicate group viewer
- **Auto-Cull** – One button to automatically keep high-scoring and reject low-scoring photos
- **Export Keepers** – Copy all "keep" photos to a destination folder
- **SQLite Persistence** – Scores and decisions are saved locally between sessions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Tauri](https://tauri.app/) (Rust backend + WebView frontend) |
| Backend | Rust – image processing, scoring, SQLite |
| Frontend | React 18 + TypeScript + Vite |
| Image processing | `image`, `imageproc` crates |
| Database | SQLite via `rusqlite` (bundled) |
| Similarity | Perceptual hashing (aHash) |
| Build/Release | GitHub Actions with `tauri-action` |

## Prerequisites

- **Rust** 1.70+ – [Install via rustup](https://rustup.rs/)
- **Node.js** 18+ – [Install via nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org/)
- **System dependencies** (Linux only):
  ```bash
  sudo apt-get install libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf
  ```

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/ClewiIdaho/JessCulling.git
cd JessCulling

# 2. Install frontend dependencies
npm install

# 3. Run in development mode
npm run tauri dev
```

The app will open in a native window. Click **Import Folder** to select a photo directory.

## Building for Production

### Local build

```bash
# Build optimized release
npm run tauri build
```

Built binaries are placed in `src-tauri/target/release/bundle/`:
- **macOS**: `.dmg` and `.app`
- **Windows**: `.msi` and `.exe`
- **Linux**: `.deb`, `.AppImage`

### GitHub Releases (automated)

Push a version tag to trigger the CI build:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Actions workflow builds for Windows, macOS, and Linux, then creates a draft release with all platform binaries attached.

## Project Structure

```
JessCulling/
├── src/                          # Frontend (React + TypeScript)
│   ├── main.tsx                  # App entry point
│   ├── App.tsx                   # Main application component
│   ├── components/
│   │   ├── Header.tsx            # App header/branding
│   │   ├── Toolbar.tsx           # Import, auto-cull, export controls
│   │   ├── PhotoGrid.tsx         # Thumbnail grid with scores
│   │   ├── PhotoDetail.tsx       # Detail panel with score breakdown
│   │   ├── DuplicatePanel.tsx    # Duplicate group viewer
│   │   └── ExportDialog.tsx      # Export destination picker
│   ├── lib/
│   │   ├── api.ts                # Tauri command bindings
│   │   └── types.ts              # TypeScript interfaces
│   └── styles/
│       └── global.css            # Full stylesheet
├── src-tauri/                    # Backend (Rust + Tauri)
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri configuration
│   ├── build.rs                  # Tauri build script
│   └── src/
│       ├── main.rs               # App entry, Tauri setup
│       ├── commands.rs           # Tauri command handlers
│       ├── db.rs                 # SQLite database layer
│       └── scoring.rs            # AI scoring algorithms
├── .github/workflows/
│   └── release.yml               # CI/CD build & release
├── index.html                    # HTML shell
├── package.json                  # Node dependencies
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript config
└── .gitignore
```

## How Scoring Works

Each imported photo is analyzed across multiple dimensions:

| Score | Weight | Method |
|-------|--------|--------|
| **Sharpness** | 35% | Laplacian variance – measures edge contrast |
| **Exposure** | 25% | Histogram analysis – checks for clipping and ideal brightness |
| **Composition** | 15% | Rule-of-thirds – measures edge energy near gridlines |
| **Face Presence** | 15% | YCbCr skin detection + connected-component sizing |
| **Eyes Open** | 10% | Contrast analysis in upper face region (when faces detected) |

When no faces are detected, face/eye weights are redistributed to sharpness and exposure.

**Duplicate detection** uses a 256-bit perceptual hash (average hash). Photos with a Hamming distance of 10 or fewer bits are grouped as potential duplicates.

## Auto-Cull Thresholds

- **Keep**: overall score >= 55%
- **Reject**: overall score < 30%
- Photos between 30-55% remain **unreviewed** for manual decision

## License

MIT
