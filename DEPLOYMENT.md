# 🚀 Deployment Guide — Free Instagram Reel Views App

This guide covers deploying the full-stack app (Express backend + static frontend) to **Render** (recommended), with alternatives for **Railway**.

---

## Prerequisites

- A [GitHub](https://github.com) account
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (free tier)
- A [Render](https://render.com) account (free tier)

---

## Step 1: Set Up MongoDB Atlas (Free Tier)

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign up.
2. Click **"Build a Database"** → Choose **M0 Free** tier → Select a region close to you.
3. Create a Database User:
   - Go to **Database Access** → **Add New Database User**.
   - Choose **Password** authentication. Note the username and password.
4. Whitelist IP Addresses:
   - Go to **Network Access** → **Add IP Address**.
   - Click **"Allow Access from Anywhere"** (`0.0.0.0/0`) for Render compatibility.
5. Get Connection String:
   - Go to **Databases** → Click **Connect** → **Connect your application**.
   - Copy the connection string — it looks like:
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your credentials.
   - Add the database name: `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/insta-views?retryWrites=true&w=majority`

---

## Step 2: Push Code to GitHub

```bash
cd "instagram views"
git init
git add .
git commit -m "Initial commit - Instagram Reel Views app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/instagram-reel-views.git
git push -u origin main
```

---

## Step 3: Deploy to Render (Recommended)

### 3a. Create a Web Service

1. Go to [https://dashboard.render.com](https://dashboard.render.com).
2. Click **"New +"** → **"Web Service"**.
3. Connect your GitHub repository.
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `instagram-reel-views` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

### 3b. Set Environment Variables

In the Render dashboard, go to your service → **Environment** → Add these variables:

| Key | Value |
|-----|-------|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/insta-views?retryWrites=true&w=majority` |
| `SMM_API_KEY` | `your_real_smm_api_key` |
| `SMM_API_URL` | `https://your-smm-panel.com/api/v2` |
| `CORS_ORIGIN` | `https://instagram-reel-views.onrender.com` |

> **⚠️ Security Note:** Never commit `.env` files. Always use the platform's environment variable settings.

### 3c. Deploy

Click **"Create Web Service"**. Render will auto-build and deploy. Your app will be live at:
```
https://instagram-reel-views.onrender.com
```

---

## Step 4: CORS Configuration

The backend is pre-configured for CORS. The `CORS_ORIGIN` environment variable controls which domains can access the API.

- **Development:** Set to `*` (allow all origins)
- **Production:** Set to your Render URL, e.g., `https://instagram-reel-views.onrender.com`
- **Multiple origins:** Comma-separated: `https://site1.com,https://site2.com`

Since both frontend and backend are served from the same Render instance, CORS is handled automatically. You only need explicit CORS config if you host the frontend separately.

---

## Alternative: Deploy to Railway

1. Go to [https://railway.app](https://railway.app) and sign up.
2. Click **"New Project"** → **"Deploy from GitHub Repo"** → Select your repo.
3. Railway auto-detects Node.js. Add environment variables in **Settings → Variables** (same as the Render table above).
4. Railway assigns a public URL like `https://instagram-reel-views.up.railway.app`.

---

## Environment Variables Summary

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | `development` or `production` | Yes |
| `MONGODB_URI` | MongoDB Atlas connection string | Yes |
| `SMM_API_KEY` | Your SMM panel API key | Yes |
| `SMM_API_URL` | Your SMM panel API endpoint | Yes |
| `CORS_ORIGIN` | Allowed frontend origin(s) | Yes |

---

## Switching from Mock to Real SMM API

Open `services/smmPanel.js`:
1. Uncomment `const fetch = require('node-fetch');` at the top.
2. Comment out the **MOCK IMPLEMENTATION** block.
3. Uncomment the **REAL IMPLEMENTATION** block.
4. Update `SMM_API_KEY` and `SMM_API_URL` environment variables with your real credentials.
5. Adjust the `service` ID to match your SMM panel's service for Instagram Reel Views.
