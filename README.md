# Esmail

This repository contains two parts:

- `plugin/` - the existing browser plugin version.
- `app/` - the Esmail demo mail app with Gmail/QQ login, AI summary, todos, compose, and local Node API.

Run the app locally:

```bash
cd app
npm install
cp .env.example .env
npm run dev:api
```

In another terminal:

```bash
npm run dev
```

Open `http://127.0.0.1:5174/`.

Before using Gmail or AI features, configure local secrets in `app/.env` and add your own Google OAuth `client_secret_*.json` file. See `app/CONFIGURATION.md`.
