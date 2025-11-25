# FinanceTracker Agent Guide

Scope: This file applies to the entire repository.

- Prefer **npm** commands inside `financetracker/` so the existing lockfile stays in sync. Do not introduce Yarn/PNPM lockfiles.
- Keep documentation current: update `README.md` files whenever you add scripts, dependencies, or setup steps.
- For Expo/React Native code, use functional components and TypeScript typings. Keep styling consistent with `theme.ts` values.
- When you touch TypeScript or TSX files, run `npm run lint` from `financetracker/` before committing, or explain why it was skipped.
- Place shared assets under `financetracker/assets/` and prefer co-locating small component-specific assets alongside their components.
