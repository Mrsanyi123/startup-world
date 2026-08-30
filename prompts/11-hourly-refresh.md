# PROMPT 11 — Hourly MRR refresh

You are a coding agent. Prompts 08–09 (and 10 if present) work on connect. Now recompute on a schedule.

## Job

- `node-cron` on the Fastify process, every hour
- `POST /internal/mrr/refresh` protected by `x-internal-secret: INTERNAL_JOB_SECRET` runs the same job (for manual test)
- For each connection: decrypt token, fetch provider subs, `computeMrr`, insert a **new** `mrr_snapshots` row (keep history)
- If token expired / 401: mark that connection broken (add `status` or `last_error` column if needed). **Do not** crash the whole job. Continue the rest.
- Compare new MRR → tier vs previous snapshot. If tier changed, emit an event the client can hear (if Socket.io is not in yet, include a `tierChangedPlotIds` in the POST response and have the client poll; Prompt 12 will broadcast)

## Client

If a plot’s tier in `GET /plots` differs from what is on screen, play the Prompt 05 construction animation. Poll every N seconds **or** listen for an event — polling every 30–60s is acceptable until 12.

Disconnected connections: keep last house, show a small “disconnected” marker (per product default).

## Do not

- Recompute on every `GET /plots`
- Delete old snapshots (we want history)
- Parallel-bomb the provider (limit concurrency, e.g. 3 at a time)

## Gate

Change MRR in the test Stripe account, hit the internal route (or wait), house updates without a full rewrite of movement/plot code. One bad token does not stop others.

When finished, note in README: how to curl the refresh route + “Phase 11 done.”
