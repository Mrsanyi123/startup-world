# PROMPT 12 — Multiplayer

You are a coding agent. Solo loop works (walk, persist claims, houses). Add other people.

Also read `About.md` §8.

## Architecture (mandatory)

- **Postgres is the source of truth** for claims, connections, MRR, tiers
- Socket.io is **ephemeral only**: positions + “something changed, refetch or here is the result”
- A dropped socket must not lose or duplicate a claim
- After `POST /plots/:id/claim` succeeds, **then** broadcast `plot:claimed` with the plot payload
- After MRR job detects a tier change, **then** broadcast `house:tier_changed` `{ plotId, tierIndex }`
- Never `claim` via a socket event

## Positions

- Clients send `player:move` ~10–15 Hz: `{ x, y, z, facingX, facingY, facingZ }` (or a compact equivalent)
- Server fan-out to others in the same planet room
- Cap **~20** sockets per room; extra connections get a “planet full” message
- On disconnect, remove that player mesh
- Other characters: reuse Prompt 03 primitive, maybe a different scarf color
- Do not interpolate on the server; cheap client interpolation is OK

## Auth

Attach Clerk session (or a short-lived server token) on socket handshake so you can show display names. Reject anonymous sockets if claim broadcasts should be trusted; anonymous **spectators** may watch if you already allow unsigned GET /plots.

## Do not

- Put owner_id updates only in Redis/memory
- Use Colyseus
- Add chat, emoji, combat, or voice
- Sync the whole planet mesh

## Gate

Two browsers: each sees the other walk. One claims → the other marker flips without refresh. One house tiers up (debug or refresh job) → the other sees construction.

When finished, note in README: “Phase 12 done — multiplayer.”
