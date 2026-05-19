# DariCap Network

DariCap Network is a mobile-first microfinance web app for client registration, loan processing, repayment tracking, and portfolio reporting.

## Local Development

Prerequisites: Node.js 18+ and npm.

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env.local`
3. Update the environment values you need
4. Start the dev server with `npm run dev`

## Build

Create a production build with:

`npm run build`

The output is generated in `dist/`.

## GitHub

The Git remote for this project is:

`https://github.com/eriqneo/Daricap.git`

Typical push flow:

1. `git add .`
2. `git commit -m "Prepare project for GitHub and Cloudflare deployment"`
3. `git push -u origin main`

## Cloudflare Pages

This repo is ready for Cloudflare Pages as a static Vite deployment.

Use these settings in Cloudflare Pages:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

Optional environment variables:

- `GEMINI_API_KEY`
- `VITE_PB_URL`

Notes:

- The app uses hash-based routing, so no SPA rewrite rule is required on Cloudflare Pages.
- PWA assets are emitted during the Vite build.
