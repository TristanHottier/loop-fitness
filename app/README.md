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

The project is deployed with the Wrangler CLI using a Cloudflare API token, not a GitHub connection. The Pages project already exists (`loop-fitness`, production branch `main`), so only the deploy step is needed on each release.

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

The API token needs the **Cloudflare Pages: Edit** permission. The account ID is required because a scoped token cannot always auto-detect the account.

### Caching

The `_headers` file in `public/` is copied to the build output and sets `Cache-Control: no-cache` on `index.html`, the service worker, the registration script and the web manifest, so updates are picked up without stale caching. Fingerprinted assets in `assets/` keep the default long-lived caching.
