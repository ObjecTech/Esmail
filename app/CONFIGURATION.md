# Esmail App Configuration

The app needs local secrets for AI and mail login. Keep real secrets out of GitHub.

## 1. Install dependencies

```bash
npm install
```

## 2. Create `.env`

Copy the template:

```bash
cp .env.example .env
```

Then edit `.env`:

```bash
CHATANYWHERE_API_KEY=your_key_here
AI_MODEL=gpt-5-mini
```

## 3. Configure Google OAuth

In Google Cloud Console, create an OAuth client for a web app and add this redirect URI:

```text
http://127.0.0.1:5175/api/auth/google/callback
```

Download the OAuth JSON file and put it in `app/` with a filename like:

```text
client_secret_xxxxx.apps.googleusercontent.com.json
```

Do not commit that file. It is ignored by `.gitignore`.

You can use `google-oauth.example.json` only as a shape reference.

Required Gmail scopes:

```text
openid
email
profile
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.send
```

## 4. QQ Mail login

QQ Mail does not use a repo-level key. Each user enters their own QQ email authorization code on the login screen.

Typical settings:

```text
IMAP host: imap.qq.com
IMAP port: 993
SMTP host: smtp.qq.com
SMTP port: 465
```

## 5. Run locally

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5174/
```

For LAN testing:

```bash
npm run dev:lan
```

Then share the Network URL printed by Vite.
