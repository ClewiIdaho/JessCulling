/**
 * Client-side image scoring engine.
 * Ports the Rust scoring algorithms from src-tauri/src/scoring.rs
 * to TypeScript using Canvas API for pixel access.
 */

/** Convert RGBA ImageData to grayscale array. */
function toGrayscale(data: Uint8ClampedArray, w: number, h: number): Float64Array {
  const gray = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/**
 * Sharpness score using Laplacian variance.
 * Higher variance = sharper image. Normalized to [0, 1].
 */
export function sharpnessScore(
  data: Uint8ClampedArray,
  w: number,
  h: number
): number {
  const gray = toGrayscale(data, w, h);
  if (w < 3 || h < 3) return 0;

  let sum = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const center = gray[y * w + x];
      const top = gray[(y - 1) * w + x];
      const bottom = gray[(y + 1) * w + x];
      const left = gray[y * w + (x - 1)];
      const right = gray[y * w + (x + 1)];

      const laplacian = top + bottom + left + right - 4 * center;
      sum += laplacian * laplacian;
      count++;
    }
  }

  const variance = count > 0 ? sum / count : 0;
  return Math.min(variance / 1000, 1);
}

/**
 * Exposure score based on histogram analysis.
 * Checks for over/under exposure. 1.0 = well exposed.
 */
export function exposureScore(
  data: Uint8ClampedArray,
  w: number,
  h: number
): number {
  const gray = toGrayscale(data, w, h);
  const total = w * h;
  if (total === 0) return 0;

  const histogram = new Uint32Array(256);
  for (let i = 0; i < total; i++) {
    histogram[Math.round(gray[i])] += 1;
  }

  // Under-exposure (bottom 10%)
  let darkPixels = 0;
  for (let i = 0; i < 26; i++) darkPixels += histogram[i];
  const darkRatio = darkPixels / total;

  // Over-exposure (top 10%)
  let brightPixels = 0;
  for (let i = 230; i < 256; i++) brightPixels += histogram[i];
  const brightRatio = brightPixels / total;

  // Mean brightness
  let meanSum = 0;
  for (let i = 0; i < 256; i++) meanSum += i * histogram[i];
  const mean = meanSum / total;
  const meanNormalized = mean / 255;

  // Ideal mean around 0.45-0.55
  const meanScore = 1 - Math.min(Math.abs(meanNormalized - 0.5) * 2, 1);

  // Clip penalty
  const clipPenalty = 1 - Math.min(Math.max(darkRatio, brightRatio) * 2, 1);

  return Math.max(0, Math.min(1, meanScore * 0.6 + clipPenalty * 0.4));
}

/**
 * Composition score using rule-of-thirds analysis.
 */
export function compositionScore(
  data: Uint8ClampedArray,
  w: number,
  h: number
): number {
  const gray = toGrayscale(data, w, h);
  if (w < 10 || h < 10) return 0.5;

  // Compute edge magnitudes
  const edgeMap = new Float64Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = gray[y * w + (x + 1)] - gray[y * w + (x - 1)];
      const gy = gray[(y + 1) * w + x] - gray[(y - 1) * w + x];
      edgeMap[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  let totalEnergy = 0;
  for (let i = 0; i < edgeMap.length; i++) totalEnergy += edgeMap[i];
  if (totalEnergy === 0) return 0.5;

  const thirdX = [Math.floor(w / 3), Math.floor((2 * w) / 3)];
  const thirdY = [Math.floor(h / 3), Math.floor((2 * h) / 3)];
  const marginX = Math.floor(w * 0.05);
  const marginY = Math.floor(h * 0.05);

  let thirdsEnergy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nearX = thirdX.some(
        (tx) => x >= Math.max(0, tx - marginX) && x <= tx + marginX
      );
      const nearY = thirdY.some(
        (ty) => y >= Math.max(0, ty - marginY) && y <= ty + marginY
      );
      if (nearX || nearY) {
        thirdsEnergy += edgeMap[y * w + x];
      }
    }
  }

  const ratio = thirdsEnergy / totalEnergy;
  return Math.max(0.1, Math.min(1, ratio / 0.35));
}

/**
 * Face detection using skin-color heuristic + connected components.
 * Returns [faceCount, eyesOpenScore].
 */
export function detectFaces(
  data: Uint8ClampedArray,
  w: number,
  h: number
): [number, number] {
  if (w < 20 || h < 20) return [0, 0];

  // Build skin mask
  const skinMask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b;

    if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
      skinMask[i] = 1;
    }
  }

  // Connected component labeling via BFS
  const labels = new Int32Array(w * h);
  let nextLabel = 1;
  const labelSizes = new Map<number, number>();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!skinMask[idx] || labels[idx]) continue;

      const label = nextLabel++;
      const queue: number[] = [idx];
      let size = 0;

      while (queue.length > 0) {
        const ci = queue.pop()!;
        if (labels[ci] || !skinMask[ci]) continue;
        labels[ci] = label;
        size++;

        const cx = ci % w;
        const cy = (ci - cx) / w;
        if (cx > 0) queue.push(ci - 1);
        if (cx < w - 1) queue.push(ci + 1);
        if (cy > 0) queue.push(ci - w);
        if (cy < h - 1) queue.push(ci + w);
      }
      labelSizes.set(label, size);
    }
  }

  const totalPixels = w * h;
  const minFace = Math.floor(totalPixels * 0.005);
  const maxFace = Math.floor(totalPixels * 0.15);
  let faceCount = 0;
  for (const size of labelSizes.values()) {
    if (size >= minFace && size <= maxFace) faceCount++;
  }

  const eyesScore = faceCount > 0 ? 0.7 : 0;
  return [faceCount, eyesScore];
}

/**
 * Perceptual hash (aHash) for duplicate detection.
 * Returns 64-char hex string (256-bit hash).
 */
export function perceptualHash(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement
): string {
  // Resize to 16x16
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 16, 16);
  const smallData = ctx.getImageData(0, 0, 16, 16).data;

  // Grayscale
  const pixels = new Uint8Array(256);
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    const v = Math.round(
      0.299 * smallData[i * 4] +
        0.587 * smallData[i * 4 + 1] +
        0.114 * smallData[i * 4 + 2]
    );
    pixels[i] = v;
    sum += v;
  }
  const avg = sum / 256;

  // Build hash
  const hashBytes = new Uint8Array(32);
  for (let i = 0; i < 256; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = 7 - (i % 8);
    if (pixels[i] >= avg) {
      hashBytes[byteIdx] |= 1 << bitIdx;
    }
  }

  return Array.from(hashBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hamming distance between two hex-encoded hashes. */
export function hashDistance(a: string, b: string): number {
  let dist = 0;
  for (let i = 0; i < a.length; i += 2) {
    const byteA = parseInt(a.substring(i, i + 2), 16);
    const byteB = parseInt(b.substring(i, i + 2), 16);
    let xor = byteA ^ byteB;
    while (xor) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/** Group photos by perceptual hash similarity. */
export function groupDuplicates(
  photos: { id: string; hash: string }[],
  threshold: number
): Map<string, string> {
  const result = new Map<string, string>();
  const assigned = new Set<number>();
  let groupIdx = 0;

  for (let i = 0; i < photos.length; i++) {
    if (assigned.has(i)) continue;
    const group: number[] = [i];
    assigned.add(i);

    for (let j = i + 1; j < photos.length; j++) {
      if (assigned.has(j)) continue;
      if (hashDistance(photos[i].hash, photos[j].hash) <= threshold) {
        group.push(j);
        assigned.add(j);
      }
    }

    if (group.length > 1) {
      groupIdx++;
      const groupId = `group_${groupIdx}`;
      for (const idx of group) {
        result.set(photos[idx].id, groupId);
      }
    }
  }
  return result;
}

/** Compute overall score from individual components. */
export function overallScore(
  sharpness: number,
  exposure: number,
  composition: number,
  faceCount: number,
  eyesOpen: number
): number {
  const base = sharpness * 0.35 + exposure * 0.25 + composition * 0.15;

  const faceBonus =
    faceCount > 0
      ? 0.15 * (1 - 1 / (faceCount + 1)) + eyesOpen * 0.1
      : sharpness * 0.1 + exposure * 0.15;

  return Math.max(0, Math.min(1, base + faceBonus));
}
