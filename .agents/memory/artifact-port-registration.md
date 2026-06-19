---
name: Artifact port must be registered in .replit [[ports]]
description: Why "DIDNT_OPEN_A_PORT" happens even when the dev server binds fine, and how to fix it.
---

# Artifact dev port must exist in `.replit [[ports]]`

The workflow supervisor only watches ports that are declared as `localPort` entries
in the root `.replit` `[[ports]]` table. If an artifact's `artifact.toml`
`localPort`/`PORT` is NOT one of those declared ports, `restart_workflow` fails with
`DIDNT_OPEN_A_PORT: didn't open port <N>` — **even though the dev server actually
binds the port** (vite logs "ready", serves 200 directly and through the
`localhost:80` proxy, and stays alive when run manually).

**Why:** the supervisor's readiness probe keys off the declared port set, not the
process's real listening sockets. App code / file size / vite plugins are irrelevant
— vite binds before app code runs, so the app cannot cause this.

**How to diagnose:** compare each artifact's `localPort` (in
`artifacts/*/.replit-artifact/artifact.toml`) against the `localPort` list in
`.replit`. Running artifacts' ports are all present; failing ones are absent. The
artifact allocator sometimes assigns an unregistered high port (e.g. 25682, 18423)
instead of a declared pool slot — that is the bug.

**How to fix:** point the artifact's `localPort` AND `PORT` at a declared-but-unused
slot from `.replit [[ports]]` (the `8082`–`8092`, `20694`, `20695` range is the dev
pool; check none is already used by another artifact). Apply via
`verifyAndReplaceArtifactToml` (copy the toml to `artifact.edit.toml`, sed the port,
replace) — it is allowed to change ports (NOT `version`). Then `restart_workflow`.

**Gotcha:** `restart_workflow` kills processes very aggressively across the repl —
even a `setsid`-detached background watcher gets swept — so you cannot externally
observe the supervised lifecycle during a restart.
