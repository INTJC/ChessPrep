# Invited Public Sharing Design

## Goal

Let a small set of invited people try the trainer through a public HTTPS URL without changing or weakening the existing local-only startup path.

## Recommended Deployment

Use Cloudflare Tunnel plus Cloudflare Access:

- The trainer continues to run locally on `127.0.0.1:8788`.
- `cloudflared` runs only on the host machine and forwards a Cloudflare HTTPS hostname to the local trainer.
- Invited users open the HTTPS URL in a browser and authenticate through Cloudflare Access email allow rules.
- Invited users do not install Node, Stockfish, Maia, VPN clients, or `cloudflared`.

## Safety Boundaries

- Default startup must stay local-only.
- The project must not require opening router ports or exposing `8788` directly to the internet.
- Engine requests must be rate-limited per client IP so public testing cannot easily overwhelm the host CPU.
- Frontend API requests must include same-origin credentials so Cloudflare Access cookies are sent to `/engine-move` and `/lichess-study`.
- Cloudflare Access is the primary authentication layer. The Node app remains a local service behind the tunnel.

## Implementation Scope

- Update `server.mjs` so direct startup listens on `HOST` from the environment, defaulting to `127.0.0.1`.
- Add exported helpers for resolving bind options and engine request rate limiting.
- Add a sharing PowerShell script that starts the local trainer and then runs a named Cloudflare tunnel.
- Keep `start-trainer.ps1` behavior unchanged.
- Add a Cloudflare tunnel config template and README instructions.
- Sync installer package files.

## Out of Scope

- Building a multi-user account system inside the trainer.
- Hosting persistent user data in a database.
- Replacing Cloudflare Access with app-local login.
- Automatically creating Cloudflare resources from this project.
