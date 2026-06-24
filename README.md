# 🏗 Site Visit Inspector

A site inspection dashboard — log checkpoints, observations, and export to Excel/CSV.

## Deploy to Netlify (5 min)

### Option A: GitHub → Netlify (recommended)

1. Create a new repo on GitHub and push this folder:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
3. Select your repo
4. Build settings are auto-detected from `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy** — done!

---

### Option B: Netlify Drop (no Git)

1. Run locally first to build:
   ```bash
   npm install
   npm run build
   ```
2. Drag the `dist/` folder onto [netlify.com/drop](https://app.netlify.com/drop)

---

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)
