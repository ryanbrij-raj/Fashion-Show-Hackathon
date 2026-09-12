import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { createSession, generateToken } from './vonage.js';
import {
  identifyGarments,
  chatAboutItem,
  tryOnComposite,
  checkFraming,
  checkGarmentFrame,
  suggestPairingsForNewItem,
  normalizeGarmentImage,
  assessItem,
  suggestPairingWithImage,
} from './gemini.js';

// Guards against corrupt captures (e.g. a client-side bug once produced the
// literal string "data:image/png;base64,null") from ever being persisted.
const MIN_VALID_IMAGE_LENGTH = 5000;
function isValidImageDataUrl(value) {
  return typeof value === 'string' && value.length >= MIN_VALID_IMAGE_LENGTH;
}

async function normalizeOrFallback(rawImage, targetDescription) {
  try {
    return await normalizeGarmentImage(rawImage, targetDescription);
  } catch (err) {
    console.error('Garment normalization failed, using raw capture', err);
    return rawImage;
  }
}

function addClosetEntries(items, rawImage, cleanImages) {
  const entries = items.map((item, i) => ({
    id: `${Date.now()}-${i}`,
    image: cleanImages[i],
    rawImage,
    ...item,
  }));
  closet.push(...entries);
  saveState();
  return entries;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// State persists to disk so a server restart during dev doesn't silently
// wipe the closet out from under a browser tab that still has old item IDs.
let closet = [];
let profile = null;
let personPhoto = null;

function loadState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    closet = data.closet || [];
    profile = data.profile || null;
    personPhoto = data.personPhoto || null;
    console.log(`Loaded ${closet.length} closet item(s) from disk.`);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Failed to load saved state', err);
  }
}

function saveState() {
  fs.writeFile(DATA_FILE, JSON.stringify({ closet, profile, personPhoto }), (err) => {
    if (err) console.error('Failed to save state', err);
  });
}

loadState();

app.get('/api/profile', (req, res) => {
  res.json(profile || {});
});

app.post('/api/profile', (req, res) => {
  profile = req.body;
  saveState();
  res.json(profile);
});

app.post('/api/frame-check', async (req, res) => {
  try {
    const { image } = req.body;
    const result = await checkFraming(image);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session', async (req, res) => {
  try {
    const sessionId = await createSession();
    const token = generateToken(sessionId);
    res.json({
      apiKey: process.env.VONAGE_APPLICATION_ID,
      sessionId,
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/closet', (req, res) => {
  res.json(closet);
});

app.delete('/api/closet', (req, res) => {
  closet = [];
  saveState();
  res.json({ ok: true });
});

app.delete('/api/closet/:id', (req, res) => {
  const index = closet.findIndex((c) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  closet.splice(index, 1);
  saveState();
  res.json({ ok: true });
});

app.post('/api/closet/scan', async (req, res) => {
  try {
    const { image } = req.body;
    const items = await identifyGarments(image);
    if (!items.length) {
      return res.status(422).json({ error: 'No clothing item recognized in that photo.' });
    }
    const cleanImages = await Promise.all(
      items.map((item) => normalizeOrFallback(image, `the ${item.color} ${item.type}`))
    );
    const entries = addClosetEntries(items, image, cleanImages);
    res.json({ items: entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/closet/auto-scan', async (req, res) => {
  try {
    const { image } = req.body;
    const result = await checkGarmentFrame(image);
    if (!result.detected || !result.items.length) {
      return res.json({ detected: false, caption: result.caption });
    }
    const cleanImages = await Promise.all(
      result.items.map((item) => normalizeOrFallback(image, `the ${item.color} ${item.type}`))
    );
    const entries = addClosetEntries(result.items, image, cleanImages);
    res.json({ detected: true, caption: result.caption, items: entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/closet/:id/assess', async (req, res) => {
  try {
    const item = closet.find((c) => c.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const reply = await assessItem(item, closet, profile, personPhoto);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/closet/:id/pairing-image', async (req, res) => {
  try {
    const item = closet.find((c) => c.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const result = await suggestPairingWithImage(item, closet, profile);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { itemId, message, history } = req.body;
    const item = closet.find((c) => c.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const reply = await chatAboutItem(item, closet, message, history, profile, personPhoto);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tryon', async (req, res) => {
  try {
    const { personImage, garmentImage, includeLoopBack = true } = req.body;
    if (!isValidImageDataUrl(personImage)) {
      return res.status(400).json({ error: 'Person image is missing or invalid — try recapturing.' });
    }
    if (!isValidImageDataUrl(garmentImage)) {
      return res.status(400).json({ error: 'Garment image is missing or invalid — try recapturing.' });
    }
    if (personImage !== personPhoto) {
      personPhoto = personImage;
      saveState();
    }
    const [resultImage, loopBack] = await Promise.all([
      tryOnComposite(personImage, garmentImage, profile),
      includeLoopBack
        ? suggestPairingsForNewItem(garmentImage, closet, profile)
        : Promise.resolve(null),
    ]);
    res.json({ resultImage, loopBack });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
