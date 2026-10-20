# SpotStrat Front

Interface SpotStrat (Vite + React). Deploy na **Vercel**; chamadas `/v1` vão para o relay [spotstrat_cloud](https://github.com/kseidel92/spotstrat_cloud).

## Desenvolvimento local

```bash
npm install
npm run dev
```

Interface em **http://127.0.0.1:7172**; proxy `/v1` → **http://127.0.0.1:7171** (API).

## Vercel

1. Importe este repo.
2. Edite `vercel.json`: troque `spotstrat-cloud.vercel.app` pela URL real do projeto **spotstrat_cloud**.
3. Variáveis (Settings → Environment Variables):
   - **`VITE_WS_ORIGIN`** — `wss://SEU-TUNNEL` (mesmo host do túnel da API; WebSocket não passa pela Vercel).
   - **`VITE_GOOGLE_CLIENT_ID`** — se usar login Google (mesmo ID da API).
4. Domínio customizado: `spotstrat.com` / `www`.

Opcional: **`VITE_API_URL`** se a API não for same-origin (ex. `https://api.spotstrat.com`). Com rewrite no `vercel.json`, deixe vazio.

## Build

```bash
npm run build
```
