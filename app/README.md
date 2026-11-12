# Fitness tracker app

Static PWA built with Vite, React and TypeScript. The service worker and web manifest are generated at build time by `vite-plugin-pwa`.

## Run locally

```sh
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`.

To preview the production build:

```sh
npm run build
npm run preview
```

## Install on Android

Open `https://loop-fitness.pages.dev` in Chrome on the phone. To install, tap the install icon in the address bar, or open the Chrome menu (three dots) and choose "Add to Home screen" or "Install app".

After installing, launch the app from the home screen icon. It runs in standalone mode and works offline. Web Push reminders require the app to be installed and online.

## Deploy to Cloudflare Pages

The app is a static site. The build outputs to `dist`, so no Pages Functions are needed.

### Pages dashboard settings

Create a Pages project from this repository with the following settings:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 22 (pinned in `.nvmrc`, read automatically by the Pages build)
- Root directory: `app` (if the repository root is the project root)

The Vite preset in the Pages dashboard applies the same build command and output directory automatically.

### Wrangler CLI (token-based, current workflow)

The project deploys through the Wrangler CLI with a Cloudflare API token; there is no GitHub connection. The Pages project already exists (`loop-fitness`, production branch `main`), so only the deploy step is needed on each release.

Set the token and account ID as environment variables (do not commit them):

```sh
export CLOUDFLARE_API_TOKEN="<your-api-token>"
export CLOUDFLARE_ACCOUNT_ID="<your-account-id>"
```

On Windows PowerShell:

```powershell
$env:CLOUDFLARE_API_TOKEN="<your-api-token>"
$env:CLOUDFLARE_ACCOUNT_ID="<your-account-id>"
```

Then build and deploy:

```sh
npm run build
npx wrangler pages deploy dist --project-name=loop-fitness --branch=main
```

The deploy prints a deployment URL. The production URL is `https://loop-fitness.pages.dev`.

The API token needs the Cloudflare Pages: Edit permission. The account ID is required because a scoped token cannot always auto-detect the account.

### Caching

The `_headers` file in `public/` is copied to the build output and sets `Cache-Control: no-cache` on `index.html`, the service worker, the registration script and the web manifest, so updates are picked up without stale caching. Fingerprinted assets in `assets/` keep the default long-lived caching.

## Backend migrations

After pulling changes that add files in `api/migrations/`, apply them before deploying the Worker (run from `api/`):

```sh
npx wrangler d1 migrations apply loop-fitness-db --remote
```

`api/wrangler.jsonc` does not store the account ID, so `CLOUDFLARE_ACCOUNT_ID` must be set (as above) for `wrangler deploy` and the migrations command too.

Migration `0005_auth_failures.sql` adds the table used to rate-limit failed authentication (10 failures per IP per 15 minutes). Until it is applied, the Worker logs an error and does not rate-limit.
