// Script to download face-api.js model files
// Run: node scripts/download-models.mjs

import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, "..", "public", "models");

const BASE_URL =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const MODEL_FILES = [
  // SSD MobileNet V1
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model-shard1",
  "ssd_mobilenetv1_model-shard2",
  // Face Landmark 68
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  // Face Recognition
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2",
];

async function downloadFile(url, dest) {
  console.log(`Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const buffer = await response.arrayBuffer();
  await writeFile(dest, Buffer.from(buffer));
  console.log(`  -> Saved: ${dest}`);
}

async function main() {
  if (!existsSync(MODELS_DIR)) {
    await mkdir(MODELS_DIR, { recursive: true });
  }

  console.log("Downloading face-api.js model files...\n");

  for (const file of MODEL_FILES) {
    const url = `${BASE_URL}/${file}`;
    const dest = join(MODELS_DIR, file);
    try {
      await downloadFile(url, dest);
    } catch (err) {
      console.error(`Error downloading ${file}:`, err.message);
    }
  }

  console.log("\nDone! Model files saved to public/models/");
}

main().catch(console.error);
