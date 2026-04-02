# Atlyx

Atlyx is a desktop inventory management app built with Electron, Vue 3, TypeScript, and SQLite.

It is designed for fast barcode-driven workflows and includes inventory tracking, labels, scanning, locations, categories, activity history, check-in/out, low stock alerts, and soft-delete trash management.

## Screenshot

![Atlyx Screenshot](assets/Screenshot%202026-04-02%20at%201.13.13%E2%80%AFPM.png)

## Features

- Inventory items with quantity, serial/tag, value, category, and location
- Barcode and QR label generation + label printing support
- Scan workflow for fast lookups and item creation when unknown barcodes are scanned
- Dashboard metrics (inventory value, low stock, overdue checkouts, category breakdown)
- Item detail timeline/history
- Bulk item actions (bulk move, bulk delete)
- Categories management
- Hierarchical locations
- Custom fields (define in Settings, fill on item create/edit)
- Check-out / check-in with overdue tracking
- Documents and image attachments
- Soft delete + Trash view with restore/empty operations
- Command palette navigation and item search
- CSV import/export
- Optional remote DB configuration in Settings (plus local mode)

## Tech Stack

- Electron 39
- Vue 3 + TypeScript
- Vite via electron-vite
- Tailwind CSS
- better-sqlite3
- bwip-js

## Project Structure

```text
src/
	main/        # Electron main process (database, IPC handlers)
	preload/     # Context bridge API exposed to renderer
	renderer/    # Vue app (views/components)
build/         # Electron build resources
```

## Prerequisites

- Node.js 20+
- pnpm 10+

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Start development mode:

```bash
pnpm dev
```

## Scripts

```bash
pnpm dev           # Start Electron + Vite in development
pnpm start         # Preview built app
pnpm format        # Run Prettier on the repo
pnpm lint          # Run ESLint
pnpm typecheck     # Type-check main + renderer
pnpm build         # Type-check + production build
pnpm build:unpack  # Build unpacked app directory
pnpm build:mac     # Build macOS package
pnpm build:win     # Build Windows package
pnpm build:linux   # Build Linux package
```

## Releases (GitHub Actions)

This repository includes a cross-platform release workflow at [.github/workflows/release.yml](.github/workflows/release.yml).

- Push a version tag like `v1.0.0` to build and release for Windows, macOS, and Linux.
- You can also run the workflow manually from the Actions tab (`workflow_dispatch`).
- On tagged runs, artifacts are published to a GitHub Release automatically.

## Data and Storage

- Local mode uses SQLite by default.
- App data and DB files are stored in Electron's userData directory.
- Storage path, database mode, import/export, and reset tools are available in Settings.

## Development Notes

- Use `pnpm format` before commits.
- Run `pnpm build` to validate both type-checking and bundling.
- IPC contracts are defined in `src/main/ipc.ts` and mirrored through `src/preload/index.ts` + `src/preload/index.d.ts`.

## License

This project is licensed under the GNU General Public License v3.0 or later (GPL-3.0-or-later).

See [LICENSE](LICENSE) for the full text.
