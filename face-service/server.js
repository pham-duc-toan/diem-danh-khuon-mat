// Load TensorFlow native backend FIRST for C++ acceleration
const tf = require("@tensorflow/tfjs-node");

const express = require("express");
const faceapi = require("@vladmandic/face-api");
const canvas = require("canvas");
const path = require("path");

// Polyfill Canvas for Node.js
const { Canvas, Image, ImageData, createCanvas } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = process.env.MODEL_PATH || path.join(__dirname, "models");
const PORT = process.env.PORT || 5050;

let modelsLoaded = false;

async function loadModels() {
  console.log(`Loading face models from: ${MODEL_PATH}`);
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
  modelsLoaded = true;
  console.log("All face models loaded successfully");
}

const app = express();
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: modelsLoaded ? "ready" : "loading" });
});

// Detect faces and extract 128-dim descriptors
app.post("/detect", async (req, res) => {
  if (!modelsLoaded) {
    return res.status(503).json({ error: "Models not loaded yet" });
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    const t0 = Date.now();

    const base64Data = image.includes(",") ? image.split(",")[1] : image;
    const imgBuffer = Buffer.from(base64Data, "base64");
    const img = await canvas.loadImage(imgBuffer);

    const t1 = Date.now();

    // Resize large images to speed up detection (max 320px on longest side)
    const MAX_DIM = 320;
    let processImg = img;
    let scale = 1;
    if (img.width > MAX_DIM || img.height > MAX_DIM) {
      scale = MAX_DIM / Math.max(img.width, img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const resizedCanvas = createCanvas(w, h);
      resizedCanvas.getContext("2d").drawImage(img, 0, 0, w, h);
      processImg = resizedCanvas;
    }

    const t2 = Date.now();

    // Use lower minConfidence for better detection on resized images
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
    const detections = await faceapi
      .detectAllFaces(processImg, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    const t3 = Date.now();

    // Scale bounding boxes back to original image size
    const invScale = 1 / scale;
    const faces = detections.map((d) => ({
      descriptor: Array.from(d.descriptor),
      box: {
        x: d.detection.box.x * invScale,
        y: d.detection.box.y * invScale,
        width: d.detection.box.width * invScale,
        height: d.detection.box.height * invScale,
      },
      score: d.detection.score,
      imageWidth: img.width,
      imageHeight: img.height,
    }));

    console.log(
      `[detect] decode=${t1 - t0}ms resize=${t2 - t1}ms inference=${t3 - t2}ms total=${t3 - t0}ms faces=${faces.length} scale=${scale.toFixed(2)} imgSize=${img.width}x${img.height}`,
    );

    res.json({ faces });
  } catch (err) {
    console.error("Detection error:", err.message);
    res.status(500).json({ error: "Face detection failed" });
  }
});

loadModels()
  .then(async () => {
    // Warmup: run a dummy detection to initialize tfjs graph (first run is always slow)
    console.log("Running warmup inference...");
    const warmupCanvas = createCanvas(160, 120);
    warmupCanvas.getContext("2d").fillRect(0, 0, 160, 120);
    const t0 = Date.now();
    await faceapi.detectAllFaces(
      warmupCanvas,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
    );
    console.log(`Warmup complete in ${Date.now() - t0}ms`);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Face service listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to load models:", err);
    process.exit(1);
  });
