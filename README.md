# kane-site
Kane's personal website — software engineering, AI coding agents, developer tools, projects and writing.

Built with [Astro](https://astro.build).

## Prerequisites

- Node.js ≥ 22.12.0
- pnpm ≥ 7.1.0 (project pinned to 12.3.4 via `packageManager`; `corepack enable` picks it up automatically)

## Install

```sh
pnpm install
```

## Dev server

```sh
pnpm dev
```

Starts the Astro dev server with hot reload at <http://127.0.0.1:4321/>.

## Build

```sh
pnpm build
```

Generates a static production build into `dist/`.

## Preview production build

```sh
pnpm preview
```

Serves the contents of `dist/` locally to verify the build before deploying. The preview server runs in the background; stop it with:

```sh
pnpm astro preview stop
```
