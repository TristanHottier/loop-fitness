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

### Wrangler CLI

For direct upload deployments, build locally and upload the output directory:

```sh
npm run build
npx wrangler pages project create
npx wrangler pages deploy dist
```

### Caching

The `_headers` file in `public/` is copied to the build output and sets `Cache-Control: no-cache` on `index.html`, the service worker, the registration script and the web manifest, so updates are picked up without stale caching. Fingerprinted assets in `assets/` keep the default long-lived caching.
