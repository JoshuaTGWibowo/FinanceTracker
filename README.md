# FinanceTracker

FinanceTracker is an Expo Router starter that ships with a neon-inspired finance dashboard, tab navigation, and a ready-made transaction modal. The app lives inside the `financetracker/` directory and runs in Expo Go for quick iteration across iOS, Android, and web targets.

## Repository layout

- `/financetracker` – Expo project with the application source, scripts, and dependencies.
- `/test.md` – Miscellaneous test notes.
- `/package-lock.json` – Root lockfile kept for reference; the active project lockfile lives in `financetracker/`.

## Getting set up in a new environment

1. **Install prerequisites**
   - Node.js 18+ and npm (Node 20 LTS recommended).
   - Optional: Expo Go on your mobile device or an iOS/Android emulator.

2. **Install dependencies**
   ```bash
   cd financetracker
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```
   - Use `npm run ios`, `npm run android`, or `npm run web` for platform-specific previews.
   - On Windows, `npx expo start --tunnel` can help pairing with Expo Go.

4. **Run linting (optional but recommended)**
   ```bash
   npm run lint
   ```

5. **Learn the app structure**
   See `financetracker/README.md` for the feature list, routing map, and next-step recommendations.

## Support

If you run into dependency issues after upgrading Node or Expo, try clearing caches with `npx expo start -c` and reinstalling `node_modules` before filing an issue.
