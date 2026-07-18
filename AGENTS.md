# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single MTA bus-arrival Vercel serverless function at `api/arrivals.js` (Vercel `(req, res)` contract). There is no README and no framework beyond `node-fetch`.

- Run locally: `npm run dev` starts a lightweight local server (`scripts/dev-server.js`) that reproduces Vercel's `req`/`res` contract and serves `api/<name>.js` at `/api/<name>` on port 3000 (override with `PORT`). Use this instead of `vercel dev`, which requires interactive Vercel login and is not usable in this environment.
- No tests or lint are configured (`npm test` is a placeholder that exits non-zero). Do not treat `npm test` as a real test suite.
- Auth: the endpoint requires header `Authorization: Bearer <MY_SECRET_KEY>`. `MY_SECRET_KEY` defaults to the literal string `MY_SECRET_KEY` when unset.
- Live data requires `MTA_API_KEY` (MTA Bus Time SIRI key). Without a valid key the upstream returns HTTP 403 "API key is not authorized." and the handler falls through to `{"message":"No bus times or situations available at this stop."}`. Set `MTA_API_KEY` to see real arrivals.
- Quick check: `curl -H "Authorization: Bearer MY_SECRET_KEY" "http://localhost:3000/api/arrivals?stopCode=MTA_400080"`.
