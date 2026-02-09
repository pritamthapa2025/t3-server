# Quote & Invoice PDF on the Server

Quote and invoice PDFs are generated with **Puppeteer** (headless Chrome). It works locally because Chrome/Edge is often already installed; on a Linux server, a browser must be available.

## Easy Panel + Nixpacks (GitHub deploy)

This repo includes a **`nixpacks.toml`** that installs Chromium during the Nixpacks build via **Nix** (`nixPkgs`), so PDFs work after deploy. Ubuntu Jammy no longer provides the `chromium` apt package (it’s snap-only), so we use Nix’s Chromium instead.

- Commit and push the latest `nixpacks.toml` and redeploy on Easy Panel.
- No extra env vars are required; the app finds Chromium in standard paths and on `PATH` (e.g. Nix profile bin).

If the build fails (e.g. Nix package name differs), set **`PUPPETEER_EXECUTABLE_PATH`** in Easy Panel to the full path of the `chromium` binary in your image.

## Fix: Install Chromium on the server (manual / VPS)

**Option A – Use system Chromium (recommended)**

On your Linux server, install Chromium. The app will auto-detect it at common paths.

**Debian/Ubuntu:**

```bash
sudo apt-get update
sudo apt-get install -y chromium-browser
# or
sudo apt-get install -y chromium
```

If the binary is in a non-standard path, set:

```bash
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium   # or chromium-browser, google-chrome, etc.
```

**Option B – Use Puppeteer’s bundled Chrome**

From your project directory on the server:

```bash
npx puppeteer browsers install chrome
```

This downloads Chrome into the Puppeteer cache (e.g. `/root/.cache/puppeteer`). Ensure that directory is writable and not removed on deploy.

**Docker**

If you run in Docker, install Chromium in the image, for example:

```dockerfile
RUN apt-get update && apt-get install -y chromium \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

## Summary

| Environment | What to do |
|-------------|------------|
| **Local (Windows)** | Usually works (Chrome/Edge or Puppeteer cache). |
| **Easy Panel + Nixpacks** | Use repo’s `nixpacks.toml` (installs Chromium); redeploy. |
| **Linux server (VPS)** | Install `chromium` or `chromium-browser` (or set `PUPPETEER_EXECUTABLE_PATH`). |
| **Docker** | Install Chromium in the image and set `PUPPETEER_EXECUTABLE_PATH` if needed. |

Puppeteer is required for the current PDF implementation; there is no non-browser PDF path in this codebase.
