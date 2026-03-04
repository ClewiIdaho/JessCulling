/**
 * Detect whether we're running inside Tauri (desktop) or a plain browser.
 * In the browser we provide demo data so the UI is visible on GitHub Pages.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI__;
}
