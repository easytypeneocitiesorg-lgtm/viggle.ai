import express from "express";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const API_BASE = "https://apis.viggle.ai/v1";
const API_KEY = process.env.VIGGLE_API_KEY;

if (!API_KEY) {
  console.error("Missing VIGGLE_API_KEY in .env");
  process.exit(1);
}

// Start Viggle-Animate job
app.post("/api/animate", upload.fields([
  { name: "character_image", maxCount: 1 },
  { name: "driving_video", maxCount: 1 }
]), async (req, res) => {
  try {
    const image = req.files?.character_image?.[0];
    const video = req.files?.driving_video?.[0];

    if (!image || !video) {
      return res.status(400).json({ error: "Both character_image and driving_video are required" });
    }

    const form = new FormData();
    form.append("character_image", image.buffer, {
      filename: image.originalname || "character.png",
      contentType: image.mimetype
    });
    form.append("driving_video", video.buffer, {
      filename: video.originalname || "driving.mp4",
      contentType: video.mimetype
    });
    // optional prompt
    if (req.body.prompt) {
      form.append("prompt", req.body.prompt);
    }

    const response = await fetch(`${API_BASE}/videos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // data.id is something like "anim_xxxx"
    res.json({ id: data.id, status: data.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Poll status
app.get("/api/status/:id", async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/videos/${req.params.id}`, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});
