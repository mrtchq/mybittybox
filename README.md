# Bitty Box — bittybox.org (production app)

Client-side programmable access-control studio: tiny, private web experiences
("Bitty Boxes") sealed by composable **Lock Lab** ceremonies (passcode, time,
burn-after-reading, invite-code, puzzle, payment, and more). The unlock rules
live in the URL fragment — no centralized database.

## Stack
- **Frontend**: React 18 + Vite + TypeScript, `motion/react`, lucide-react.
- **Locks engine**: `src/locks/` — a uniform `LockPlugin` registry + ceremony
  (combiner) tree, fully serializable to a URL-safe config.
- **Backend**: `/var/www/bittybox-api` (Express) serving the API + MCP and the
  static SPA.
- **Deploy**: `npm run build` in this repo → copy `dist/*` into
  `/var/www/bittybox.org/docs` → restart `bittybox-api.service`.

## Build
```bash
cp /var/www/bittybox.org/.env .env   # Firebase/Creem keys (never commit)
npm install
npm run build
```

## Notes
- `dist/` is build output (served live) and is gitignored.
- `.env` / `env` contain secrets — gitignored.
- Wave 1 lock coverage: 8 engine-wired Tier-1 locks + 6 client-evaluable
  (invite-code, qr-proximity, puzzle, proof-of-human, browser-key, payment) +
  11 server-gated stubs (clickable, always-pass pending backend).
