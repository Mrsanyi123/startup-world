# PROMPT 06 — HUD and on-planet UI

You are a coding agent. Prompts 01–05 are done: walk, plots, stub houses.

Add the **screen UI** only. Keep it quiet — Messenger-like, not a game HUD full of bars.

## Screens / overlays

1. **Top-left (always, tiny)**  
   Game name “Startup Village” (or a `GAME_NAME` constant). Optional: plot count claimed / 32.

2. **Claim prompt** (already partly in 04)  
   Center-bottom, only when in range of an unclaimed plot and the player has no plot.  
   “Press E to claim this plot”

3. **You already have a plot**  
   If in range of a plot that is not yours: show owner + tier, not a claim button.

4. **Your plot panel** (when you own a plot)  
   Bottom or corner card:
   - “Your plot”
   - Current tier label
   - MRR if you would show it to yourself (owner always sees their own number)
   - Toggle: “Show my MRR to others” (wire the boolean in local/stub state; real API is Prompt 07/09)
   - Button: “Connect Stripe” and “Connect Polar” — **disabled / “Coming soon”** labels are fine. Do not invent fake OAuth.

5. **Click / pointer hint**  
   If look-requires-click: “Click to look around” until they do.

6. **Sign in**  
   A simple “Sign in” button in the corner that does nothing or `console.log` — real Clerk is Prompt 07. Style it so 07 can drop Clerk in.

Plain CSS. Readable on the canvas. No Tailwind required. No pause menu, inventory, minimap, or chat.

## Do not

- Build a marketing landing page
- Add settings for graphics quality
- Start Clerk or Stripe
- Cover more than ~15% of the screen at rest

## Gate

UI is usable while walking. Claim prompt appears/disappears with range. Owner card only after you claimed. Connect buttons visible but not live.

When finished, note in README: “Phase 06 done — HUD.”
