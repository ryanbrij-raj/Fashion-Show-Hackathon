# Closet Co-Shopper — Hackathon Starter

Demo-first React + Express starter for a closet-aware AI stylist.

## Working now
- Local camera preview
- Snapshot closet scan -> Gemini structured inventory
- Inventory-scoped stylist chat
- “Should I Buy This?” image analysis
- Mock inventory fallback when Gemini key is absent
- Vonage server endpoint that creates/reuses a Video session and generates a publisher token

## Run
```bash
cd closet-co-shopper-starter
npm install
npm run install:all
cp server/.env.example server/.env
# fill in server/.env
npm run dev
```
Open the Vite URL (normally http://localhost:5173).

## Vonage
Put the application private key in `server/private.key` and set `VONAGE_APPLICATION_ID`.
Never put the private key in the React app.

## Next hackathon steps
1. Add OpenTok/Vonage Web SDK to the camera panel and fetch `/api/video/session`.
2. Auto-sample 3–5 frames during a 5-second closet sweep instead of a manual snapshot.
3. Add Gemini image editing endpoint for snapshot-based virtual try-on.
4. Add Closet DNA and compatibility score cards.
