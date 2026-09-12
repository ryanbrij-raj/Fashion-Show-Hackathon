sty# Closet Co-Shopper

### An AI Stylist That Can See Your Closet — and See You

**Hackathon:** Fashion-focused app built on Gemini + Vonage APIs
**Team size:** 2–4
**Format:** One day

---

## 1. Pitch (one sentence)

An AI co-shopper that scans your real closet using live video, then lets you ask what goes with anything you own, and virtually try on anything new — all through one running conversation.

---

## 2. Why This Problem

A prior fashion-discovery project I worked on was built on the idea that fashion shopping is fundamentally about ambiguous, contextual questions — "what goes with this," "something for a rooftop dinner," "find me something like this but more casual" — the kind of intent-driven requests keyword search can't handle. That earlier AI co-shopper worked as a chat interface, but it only knew a generic product catalog, never the user's actual closet.

This project closes that gap. It uses live video for the two moments where static photo uploads create real friction:

- **Cataloging an entire closet** (nobody photographs 40 items one at a time)
- **Previewing something you don't own yet** (uploading a photo and waiting is slower than standing in front of a camera)

This also directly fits the hackathon prompt: it combines two of the suggested categories — _virtual try-on rooms_ and _AI personal stylists_ — into one cohesive product instead of a single standalone demo feature.

---

## 3. Core Flow

**Step 1 — Closet Scan** _(Vonage + Gemini, one-time setup)_
Open the camera and sweep it across your closet in one continuous motion. Gemini samples frames from the live Vonage feed and builds a structured inventory (item type, color, category) — no manual per-item photo uploads.

**Step 2 — Item-Scoped Chat** _(Gemini, chat)_
Tap any cataloged item to open a chat scoped to it. Ask "what goes with this," "dress this up for an interview," "something more casual." The co-shopper answers using only your real inventory from Step 1, so every suggestion is something you actually own.

**Step 3 — Try On Something New** _(Vonage + Gemini, on demand)_
Found something online, or the co-shopper flagged a gap in your closet? Upload a photo of the item. Then either stand in front of the live camera, or upload a photo of yourself — Gemini composites the item onto you either way.

**Step 4 — Loop Back**
Immediately after a try-on, ask what you already own that pairs with the new piece — connecting "discovering something new" back into "using what you have."

One continuous chat thread ties all four steps together — it's one conversation about your wardrobe, not separate disconnected tools.

---

## 4. Why Vonage Matters Here (not just a checkbox)

The closet scan needs a _sustained_ video session — sampling frames continuously as you move the camera — which is a genuinely different technical shape than one-off image uploads, and it's exactly what Vonage's video pipeline is built for. The live try-on option reuses the same session infrastructure rather than requiring a separate build.

---

## 5. Architecture

| Layer    | Choice                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| Frontend | React — one camera/chat interface, reused across scan and try-on                                                      |
| Video    | Vonage Video API — single-publisher session (just you, no second participant)                                         |
| AI       | Gemini — multimodal calls for closet-item identification, chat/recommendation logic, and image composition for try-on |
| Backend  | Thin Node/Express or NestJS — Vonage token generation, Gemini proxy, in-memory or SQLite-backed closet inventory      |

**Flow diagram:**

```
Camera (scan or try-on) → Vonage session → Backend samples frames
       → Gemini (identify / composite) → Chat UI (recommendations)
       → Closet inventory (persists across the session)
```

---

## 6. Full Feature List

### Core Flow Features (must-build, in priority order)

1. **Closet Scan** — sweep a live camera across your closet; Gemini samples frames and builds a structured inventory without manual per-item uploads
2. **Item-Scoped Chat** — tap any cataloged item to open a chat scoped to it; ask what goes with it, get answers pulled only from your real inventory
3. **Try-On (new item)** — upload a photo of an item, then stand in front of the live camera or upload a selfie; Gemini composites the item onto you
4. **Try-On → Closet Loop** — after a try-on, ask what you already own that pairs with the new piece

### Connective / Cohesion Features

5. **Persistent Chat Thread** — one running conversation across scanning, asking, and trying on
6. **"Complete the Look"** — after any try-on or recommendation, the co-shopper proactively suggests 1–2 owned items to complete the outfit, unprompted

### Stretch Features (build only if ahead of schedule)

7. **Closet Gap Detection** — after scanning, proactively flag real gaps ("no neutral outerwear," "no formal shoes")
8. **Occasion Mode** — set context upfront ("interview Friday") so recommendations and try-ons narrow around it for the session
9. **Fit History / Memory** — remembers past try-ons or feedback so future suggestions improve
10. **Multi-Item Try-On** — composite more than one new piece at once (a full outfit, not just a single item)
11. **Closet Search** — quick text/voice search over scanned inventory, separate from the recommendation chat
12. **Session Recap** — end-of-session summary of everything scanned, tried on, and recommended

### Explicit Cut List (deprioritize first if time is short)

- True real-time live video generation for try-on (fall back to "snap frame → generate result in a few seconds")
- Multi-item try-on
- Fit history / memory

---

## 7. One-Day Build Order (team of 3–4)

| Person     | Focus                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A          | Vonage session + token server; camera streaming working end-to-end                                                                        |
| B          | Gemini closet-scan logic — sampling frames, accumulating a deduplicated inventory                                                         |
| C          | Chat UI + recommendation logic scoped to inventory (build this early — it's the demo safety net even with a hardcoded fake inventory)     |
| D _(if 4)_ | Try-on compositing (upload item → live camera or selfie → generated result); wire "what goes with this" back in after a successful try-on |

**Suggested sequence across the day:**

1. Vonage session/token server + basic camera streaming
2. Chat UI with hardcoded inventory (safety net demo, working early)
3. Gemini closet-scan logic replacing the hardcoded inventory
4. Try-on compositing
5. Wire try-on back into chat ("complete the look")
6. Polish + stretch features if time allows

---

## 8. Demo Narrative for Judges

> "Fashion shopping is full of ambiguous, contextual questions that keyword search can't answer. This is what it looks like when an AI stylist can actually see your closet — and see you."

Show the flow live: scan a small set of items → ask the chat what goes with one of them → upload a photo of something new → try it on live → ask again what pairs with it. One continuous story, not three separate features.

---

## 9. Open Questions Before Build Day

- How many closet items to pre-stage for a reliable demo (recommend 8–12 curated pieces so the scan is fast and accurate)
- Which Gemini model/endpoint for image compositing vs. text chat (test both before the event)
- Fallback plan if live compositing latency is too slow for a smooth demo (static side-by-side comparison as backup)
