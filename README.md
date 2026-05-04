# Esmail

This repository contains two parts:

- `app/`: the Esmail web app, with Gmail / QQ Mail sign-in, mailbox views, AI summaries, AI drafting, todos, and custom classification.
- `plugin/`: the browser extension version, kept as a separate project.

## Online App

Current hosted app:

https://esmail-demo.vercel.app

After pushing new code, wait for the Vercel production deployment to finish before checking the hosted app. You can also inspect the latest Production Deployment in the Vercel project dashboard.

## Run The App Locally

Enter the app directory:

```bash
cd app
npm install
cp .env.example .env
```

Edit `app/.env`. At minimum, configure:

```bash
API_PORT=5175
FRONTEND_ORIGIN=http://127.0.0.1:5174
CHATANYWHERE_API_KEY=your ChatAnywhere API key
CHATANYWHERE_BASE_URL=https://api.chatanywhere.tech/v1
AI_MODEL=gpt-5-mini
```

There are two ways to configure Google sign-in. Option 1 is environment variables:

```bash
GOOGLE_CLIENT_ID=your Google OAuth Client ID
GOOGLE_CLIENT_SECRET=your Google OAuth Client Secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:5175/api/auth/google/callback
```

Option 2 is to place the Google Cloud `client_secret_*.json` file in the `app/` directory. Do not commit `.env` or `client_secret_*.json`.

In Google Cloud Console, add this local callback URL to the OAuth Client's Authorized redirect URIs:

```text
http://127.0.0.1:5175/api/auth/google/callback
```

Start the local API server:

```bash
npm run dev:api
```

In a second terminal, start the frontend:

```bash
npm run dev:lan
```

Open:

```text
http://127.0.0.1:5174
```

QQ Mail sign-in does not require server environment variables. On the login page, enter the QQ Mail address and a mail authorization code. The authorization code is not the QQ password; generate it in QQ Mail settings.

## Deploy Or Update The Online App

The app is designed to deploy on Vercel. Set the Vercel project's Root Directory to:

```text
app
```

Recommended Vercel environment variables:

```bash
FRONTEND_ORIGIN=https://esmail-demo.vercel.app
CHATANYWHERE_API_KEY=your ChatAnywhere API key
CHATANYWHERE_BASE_URL=https://api.chatanywhere.tech/v1
AI_MODEL=gpt-5-mini
GOOGLE_CLIENT_ID=your Google OAuth Client ID
GOOGLE_CLIENT_SECRET=your Google OAuth Client Secret
GOOGLE_REDIRECT_URI=https://esmail-demo.vercel.app/api/auth/google/callback
SESSION_SECRET=a long random string
```

Also add this production callback URL to the Google Cloud Console OAuth Client's Authorized redirect URIs:

```text
https://esmail-demo.vercel.app/api/auth/google/callback
```

If Vercel is connected to the GitHub repository, pushing to `main` automatically triggers a production deployment. To deploy manually:

```bash
cd app
npm install
npm run build
npx vercel --prod
```

After deployment, open the Production URL shown by Vercel. If you use a custom domain, update `FRONTEND_ORIGIN` and `GOOGLE_REDIRECT_URI` to use that domain.

## Useful Commands

```bash
cd app
npm test
npm run build
```
