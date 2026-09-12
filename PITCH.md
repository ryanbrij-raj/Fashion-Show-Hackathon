# The Jerry — Pitch

## 10-second pitch

The Jerry is AI styling that starts with your closet, not your cart.

## 30-second pitch

Most fashion AI tells you what to buy. The Jerry does the opposite — it learns your style and the clothes you already own, then uses Gemini to rescue the pieces you stopped wearing, build outfits for wherever you're headed, and decode the fashion language of anyone from Tyler, the Creator to Bruce Wayne, translated into your own wardrobe. A live Vonage Video session turns styling into something you actually do, not just read.

## 60-second pitch

Fashion apps are built to sell you something. The Jerry is built to help you rediscover what's already in your closet — the corduroy overshirt you forgot how to wear, the cardigan that's "too old-fashioned," the pieces sitting unused because you never saw them next to the right things.

Show The Jerry a forgotten garment through a live Vonage Video session, and Gemini identifies it — color, material, silhouette, formality — and asks why you don't wear it. That answer directly shapes what comes next: three outfits built almost entirely from your own closet, explained in plain language, never asking you to buy anything unless something is genuinely missing.

The same closet and style profile power Style Me Now (three outfits — Safe, Current, Push Me — for wherever you're going), Trend Radar (about 50 current fashion signals, personalized against your actual style and closet with a deterministic match score, not a vibe), and Style Like Someone, which decodes the recognizable fashion language of a real person or fictional character and translates it — never copies it — into what you already own.

Every outfit can launch AI Stylist Mode: a full-screen live camera session where Gemini walks you into the look step by step, then critiques it and hands you a shareable Look Card.

## 90-second demo script

1. **Dashboard** — "Most fashion AI tells you what to buy. The Jerry starts with what you already own." Show the style profile (minimal, streetwear, workwear — relaxed fit).
2. **Trend Radar** — "We track about 50 current fashion signals." Point at the personalized match hero: *Modern Workwear, 96% for you — you already own everything you need.* "Instead of blindly following trends, Gemini determines which ones actually fit me."
3. **Rescue My Closet** — hold up the brown corduroy overshirt. Gemini reads it live over Vonage Video. Type: *"It feels too old-fashioned."*
4. **Outfits generate** from the closet, explicitly addressing that reason.
5. **Style Like Someone** — type "Tyler, the Creator." Watch the decode: *Colorful Prep, Vintage Americana, Relaxed Tailoring.* Then *Your Version*, built from the same closet.
6. **Wear This Look** → AI Stylist Mode (Vonage Video, full screen) → Check My Look → the Look Card appears: *Rescued, not replaced.*
7. Close: **"You didn't need someone else's wardrobe. You needed a new way to see your own."**

## Problem

Fashion recommendation tools default to one move: sell you something new. That's expensive, it's wasteful, and it ignores the fact that most closets already contain more good outfits than their owners realize — they just can't see the combinations.

## Solution

The Jerry's ranking is closet-first, in this order: wear it as-is → restyle it → substitute something you own → only then flag a genuinely missing piece. Gemini and a deterministic scoring engine work together so every recommendation is explainable and grounded in what you actually have.

## Why Gemini is essential

Gemini is doing real multimodal reasoning, not decoration:

- **Garment recognition** from a live camera frame — category, material, silhouette, formality, style tags — used to build the closet.
- **Style discovery** during onboarding — clothing-only visual analysis of an outfit, never the body wearing it.
- **Outfit generation** grounded in a specific closet: every rescue/Style-Me-Now/persona prompt is handed the user's actual garment list and instructed to build from it first.
- **Persona decoding** — turning "Tyler, the Creator" or "Wednesday Addams" into structured, reusable style metadata (signature pieces, silhouettes, recurring principles) instead of a single outfit guess.
- **Live AI Stylist Mode** — sequential dressing instructions and a final styling critique from a live frame.

Every structured response is validated with Zod before it reaches the UI, and match *scores* are computed deterministically — Gemini explains them, it doesn't invent them.

## Why Vonage is essential

The camera is the app's central interaction surface, not a bolted-on feature. A real Vonage Video session (`@vonage/server-sdk` + `@vonage/video` server-side, `@vonage/client-sdk-video` in the browser) powers every capture moment — showing Gemini a rescue item, capturing a closet piece, and especially AI Stylist Mode, a full-screen live session where the outfit gets checked in real time. The session/token architecture already supports multiple participants, so a "video call your stylist" mode is a natural next step, not a rebuild.

## Why this isn't another shopping app

There's no product catalog, no checkout flow, no affiliate links. The only "purchase" language in the entire app is a clearly-labeled, optional "one piece away" note — and even then, The Jerry never fabricates price, stock, or size availability it doesn't actually have.

## Trend Radar

~50 cached trend concepts (not products) — garments, silhouettes, colors, materials, patterns, styling techniques, footwear, accessories, aesthetics — each carrying source attribution and a **Trend Signal** (`0.40×recency + 0.35×cross-source presence + 0.25×source authority`, normalized 0–100). Personalization is a second, separate deterministic score (`0.35×style + 0.30×closet + 0.15×fit + 0.20×trend strength`) — Gemini only explains the *why*.

## Style Like Someone

The core principle: **decode the style, don't copy the person.** Twelve personas ship cached (real people and fictional characters alike) with fashion-only metadata — never biographical claims, never physical description. An intensity slider (Subtle → Recognizable → Iconic) blends how far a translated outfit leans into the persona's language vs. the user's own established style, and every result reports a Style Similarity breakdown that is explicitly about clothing, never appearance.

## Technical architecture

Next.js App Router + TypeScript + Tailwind, Zod-validated at every AI boundary, no database — `localStorage` for the user's profile/closet and a cached JSON dataset for trends/personas, so the hackathon demo never depends on live scraping, a database, or fragile infrastructure. Every Gemini and Vonage call lives behind a server-only module; secrets never reach the browser bundle. Demo Mode exercises all four hero experiences end to end with zero API credentials.

## Sustainability

Every rescue reports a clearly-labeled *estimate* — a forgotten garment returned to rotation, a rough range for the replacement purchase avoided, and a rough number of potential additional wears. No exact-dollar or carbon-emission claims; the point is directional, not scientific.

## Future vision

Multi-person Vonage sessions for a shared "style your friend" mode, a Style Blend screen (two personas fused by a slider — already modeled in the types), and light server-side persistence so a closet can follow a user across devices.
