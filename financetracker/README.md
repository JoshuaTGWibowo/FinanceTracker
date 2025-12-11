# FinanceTracker Expo App

A minimalist finance tracker MVP built with Expo Router, TypeScript, Zustand, and a dark neon aesthetic. Designed for seamless use inside Expo Go on iOS with a modular structure that combines local SQLite storage for sensitive data with Supabase cloud storage for social features.

## Features

- **Bottom tab navigation** with Home, Transactions, Leaderboard, and Account screens powered by Expo Router.
- **Home dashboard** showing balance, monthly insights, and a 7-day cash flow mini bar chart rendered with `react-native-svg`.
- **Floating action button** to add new transactions in a polished modal using the native date picker.
- **Auto Add with AI** - Take a photo of a receipt or bank statement and AI extracts transactions automatically using Google Gemini Vision.
- **Transactions feed** grouped by day with income in green and expenses in red.
- **Account settings** to tweak the profile name and preferred currency.
- **Hybrid storage architecture**: SQLite for private financial data, Supabase for leaderboards, crews, and missions.
- **Global state** handled via Zustand with persistent storage via SQLite.

## Project structure

```
app/
  _layout.tsx            // Root stack & modal wiring
  (tabs)/                // Bottom tab routes
    _layout.tsx
    home.tsx
    transactions.tsx
    leaderboard.tsx
    account.tsx
  transactions/
    new.tsx              // Add transaction modal
components/
  MiniBarChart.tsx
lib/
  store.ts               // Zustand store + seed data
theme.ts                 // Shared colors, spacing, typography, components
```

## Getting started on Windows

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Supabase** (required for social features)
   - Create a project at [https://supabase.com](https://supabase.com)
   - Run the SQL schema in `supabase-schema.sql` in your Supabase SQL Editor
   - Copy `.env.example` to `.env` and add your Supabase credentials:
     ```
     EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
     EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
   - Find these values in your Supabase project settings at: **Settings > API**

3. **Configure Google Gemini AI** (required for Auto Add feature)
   - Get a free API key at [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
   - Add it to your `.env` file:
     ```
     EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
     ```
   - Note: The free tier has generous limits for personal use

4. **Start the Expo dev server**
   ```bash
   npx expo start --tunnel
   ```
   The `--tunnel` flag is recommended on Windows to avoid local network configuration issues when pairing with an iOS device running Expo Go.

5. **Open the app**
   - Scan the QR code with the Camera app on your iPhone and open with Expo Go, **or**
   - Run `npx expo start --ios` from a Mac if you have access to the iOS simulator.

## Key dependencies

- `expo-router` for typed, file-based navigation
- `zustand` for simple global state management
- `expo-sqlite` for local SQLite database storage
- `@supabase/supabase-js` for cloud storage and social features
- `@react-native-async-storage/async-storage` for Supabase session persistence
- `@react-native-community/datetimepicker` for native date selection
- `react-native-svg` for the dashboard mini chart
- `dayjs` for lightweight date formatting

All dependencies ship with Expo SDK 54 defaults, so no native configuration is required.

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Launch the Expo dev server |
| `npm run ios` | Shortcut for `expo start --ios` |
| `npm run android` | Shortcut for `expo start --android` |
| `npm run web` | Launch the web preview |
| `npm run lint` | Run Expo's ESLint preset |

## Architecture: Hybrid Storage

This app uses a **hybrid storage approach** to balance privacy and social features:

### Local Storage (SQLite)
- Transaction details with actual amounts
- Account balances
- Budget goals
- All sensitive financial data

### Cloud Storage (Supabase)
- User profiles (username, avatar)
- **Anonymized** leaderboard stats (savings %, streak days, points)
- Crew memberships and missions
- Achievements and gamification data

**Privacy guarantee:** No actual transaction amounts or sensitive financial data is ever sent to Supabase. Only anonymized metrics like "saved 20% this month" or "5-day streak" are synced for social features.

## How to Sync Data

To push your local metrics to the leaderboard:

```typescript
import { syncMetricsToSupabase } from './lib/sync-service';
import { useFinanceStore } from './lib/store';

const { transactions, budgetGoals } = useFinanceStore.getState();
await syncMetricsToSupabase(transactions, budgetGoals);
```

This calculates anonymized stats from your local data and uploads them to Supabase for leaderboard rankings.

## Next steps

- Implement user authentication with Supabase Auth
- Build the crew creation and mission assignment UI
- Add real-time leaderboard updates with Supabase subscriptions
- Create achievement unlock notifications

Enjoy tracking your spending! ✨
