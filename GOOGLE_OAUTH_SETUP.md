# Google OAuth Setup Guide

## Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console**: https://console.cloud.google.com/

2. **Create a new project** (or select existing)
   - Click "Select a project" → "New Project"
   - Name it "FinanceTracker" → Create

3. **Enable Google+ API**
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click and Enable it

4. **Create OAuth Consent Screen**
   - Go to "APIs & Services" → "OAuth consent screen"
   - Select "External" → Create
   - Fill in:
     - App name: `FinanceTracker`
     - User support email: Your email
     - Developer contact: Your email
     - **Application home page**: `https://financetracker.app` (or your domain)
     - **Application privacy policy**: Leave blank for testing or add your policy URL
     - **Authorized domains**: Add `supabase.co` (this removes the unverified warning)
   - Click "Save and Continue"
   - Skip "Scopes" → "Save and Continue"
   - Add test users (your email) → "Save and Continue"
   
   **Note**: To hide the Supabase URL and make it look professional, you need to:
   - Either publish your app (requires verification)
   - Or keep it in "Testing" mode and only add specific test users

5. **Create OAuth Client ID - Web Application**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Web application** (required for Supabase)
   - Name: `FinanceTracker Web`
   
   **Authorized redirect URIs** - Add **ONLY** this URL:
   ```
   https://wdfirowqsecwvvsylguj.supabase.co/auth/v1/callback
   ```
   
   ⚠️ **Important**: Do NOT add `exp://` or `financetracker://` URLs here - Google rejects them!
   The OAuth flow goes: Google → Supabase → Your App, so only Supabase needs to be here.
   
   - Click "Create"
   - **Save your Client ID and Client Secret** - you'll need them!

6. **Create OAuth Client ID - iOS Application** (for App Store later)
   - Click "Create Credentials" → "OAuth client ID" again
   - Application type: **iOS**
   - Name: `FinanceTracker iOS`
   - Bundle ID: `com.yourname.financetracker` (use your actual bundle ID)
   - Click "Create"
   - This will be needed when you publish to App Store
   - For now, focus on the Web application credentials above

## Step 2: Configure Supabase

1. **Go to your Supabase Dashboard**: https://app.supabase.com/

2. **Navigate to Authentication**
   - Go to "Authentication" → "Providers"

3. **Enable Google Provider**
   - Find "Google" in the list
   - Toggle it **ON**
   - Paste your **Client ID**
   - Paste your **Client Secret**
   - Click "Save"

## Step 3: Update Redirect URLs in Supabase

1. Still in Supabase, go to "Authentication" → "URL Configuration"

2. **Site URL**: Set to `financetracker://auth/callback`

3. **Add Redirect URLs** (under "Redirect URLs"):
   ```
   financetracker://auth/callback
   financetracker://*
   exp://127.0.0.1:19000/--/auth/callback
   exp://*
   http://localhost:8081/--/auth/callback
   ```

4. Click "Save"

**Why the Supabase URL shows**: This is normal for OAuth flows - Google shows where the OAuth is being processed. To make it more professional:
   - Use a custom domain for your Supabase project (Pro plan feature)
   - Or users will just see it briefly during sign-in (most apps work this way)

## Step 4: Test It!

1. **Restart your Expo server**:
   ```powershell
   npx expo start
   ```

2. **Open the app** → Go to Leaderboard tab

3. **Click "Continue with Google"**
   - Browser will open
   - Sign in with your Google account
   - Grant permissions
   - Should redirect back to app
   - Success! 🎉

## Troubleshooting

### "Safari cannot open the page because the address is invalid"
This happens when the OAuth flow isn't properly configured. **Fix**:

1. **In Google Cloud Console** - Make sure you have ONLY this redirect URI:
   ```
   https://wdfirowqsecwvvsylguj.supabase.co/auth/v1/callback
   ```
   Remove any `exp://` or `financetracker://` URLs - Google doesn't accept them!

2. **In Supabase** - Authentication → URL Configuration:
   - Site URL: `exp://192.168.0.14:8081` (use YOUR IP from terminal)
   - Add redirect URLs:
     ```
     financetracker://auth/callback
     exp://192.168.0.14:8081/--/auth/callback
     exp://localhost:8081/--/auth/callback
     http://localhost:8081/--/auth/callback
     ```

3. **Important**: Make sure your Supabase redirect URLs include the `exp://` URL with YOUR actual IP

4. **Wait 2-5 minutes** for changes to propagate

5. **Try again** - OAuth should now work!

### "Redirect URI mismatch" error
- Make sure the Supabase callback URL is in Google Cloud Console authorized redirect URIs
- Should be: `https://wdfirowqsecwvvsylguj.supabase.co/auth/v1/callback`

### "Invalid client" error
- Check that your Google Client ID and Secret are correct in Supabase
- Make sure Google+ API is enabled in Google Cloud Console

### Browser doesn't close after sign-in
- This is normal on some devices
- User should manually return to the app
- Session will still be created successfully

### The unprofessional "wdfirowqsecw..." URL
This is your Supabase project URL and is **normal** for OAuth flows. Users see it briefly during authentication. To improve:
- **Option 1**: Upgrade to Supabase Pro and use a custom domain
- **Option 2**: Accept it - most apps (including big ones) show similar technical URLs during OAuth
- The URL only appears for a few seconds during sign-in

### Testing on physical device
When testing on a real device, you may need to add additional redirect URLs:
```
exp://[YOUR-IP]:19000/--/auth/callback
```
Replace `[YOUR-IP]` with your computer's IP address shown in Expo dev server.

## For Production (App Store Release)

When you're ready to publish to the App Store:

1. **Use the iOS OAuth Client ID**
   - In Supabase, you can add the iOS Client ID as an additional provider
   - Or keep using the Web client ID (both work)

2. **Update app.json with your bundle ID**
   ```json
   "ios": {
     "bundleIdentifier": "com.yourname.financetracker",
     "supportsTablet": true
   }
   ```

3. **Build the app**
   ```
   eas build --platform ios
   ```

The redirect URI `financetracker://auth/callback` will work in production since it uses your app's custom scheme.

## What's Implemented

✅ "Continue with Google" button at top of auth form
✅ OAuth flow with WebBrowser
✅ Automatic session creation after Google sign-in
✅ User profile auto-created in Supabase
✅ Works with email/password sign-in as fallback

The Google button is now the primary sign-in method, with email/password as a backup option!
