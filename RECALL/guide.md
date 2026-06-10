# Recall — Testing & Runner Guide

This guide details how to run, test, and verify the three main clients of the Recall monorepo: the **Next.js Web Dashboard**, the **Expo Mobile Client**, and the **Chrome Browser Extension**.

---

## ⚡ Windows Quick-Start Terminal Commands

Here are the exact terminal commands to run the application clients on Windows (CMD or PowerShell):

### 🖥️ Option A: Run via Monorepo Root (Single Terminal)
To start the Next.js web application and the shared library compiler concurrently in one terminal:
```cmd
:: Open Command Prompt (cmd) in the project root folder:
cd "c:\Users\User\Desktop\Summer Break 2026\Summer-2026\RECALL"

:: Run the dev server:
pnpm dev
```

---

### 🖥️ Option B: Run via Separate Terminals (Recommended to avoid port clashes)

#### Terminal 1 — Next.js Web Dashboard
```cmd
:: Open Command Prompt, go to root, and run the Next.js client dev server:
cd "c:\Users\User\Desktop\Summer Break 2026\Summer-2026\RECALL"
pnpm --filter @recall/web dev
```

#### Terminal 2 — Expo Mobile Client (Launch in tunnel mode for physical device connections)
```cmd
:: Open Command Prompt, go to the mobile package, and start Metro:
cd "c:\Users\User\Desktop\Summer Break 2026\Summer-2026\RECALL\apps\mobile"
npx expo start --tunnel --clear
```

---

## 📋 Prerequisites

Before running any client, ensure your local environment files are configured.

1.  **Web Environment Setup:**
    *   Verify the existence of [apps/web/.env.local](file:///c:/Users/User/Desktop/Summer%20Break%202026/Summer-2026/RECALL/apps/web/.env.local) containing:
        ```env
        NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
        NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
        ```
2.  **Mobile Environment Setup:**
    *   Verify the existence of [apps/mobile/.env](file:///c:/Users/User/Desktop/Summer%20Break%202026/Summer-2026/RECALL/apps/mobile/.env) containing:
        ```env
        EXPO_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
        EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
        ```

---

## 🌐 1. Next.js Web Dashboard

The web client provides a desktop-optimized view of your library with sliding drawers, category metrics, and real-time syncing.

### How to Run:
Navigate to the root directory and start the Next.js development server:
```bash
pnpm --filter @recall/web dev
```
*   **Access:** Open [http://localhost:3000](http://localhost:3000) in your web browser.

### How to Test:
1.  **Sign Up:** Click **Sign Up**, fill in your credentials, and submit. The database trigger will automatically verify your email, allowing you to log in instantly.
2.  **Add a Link:** In the left-hand panel, paste a URL (e.g., `https://news.ycombinator.com`) and add an optional note. Click **Save Link**.
3.  **Real-Time Update:** Once submitted, the link card will appear in the main feed as **Pending**. Once the background Supabase Edge Function finishes analyzing it, the card will automatically update to **Ready** with generated takeaways and resource tags.
4.  **Side Drawer:** Click on any link card in the dashboard. A drawer will slide out from the right showing key takeaways, extracted developer tools/resources, and safety metadata.

---

## 📱 2. Expo Mobile App

The mobile client is built on React Native & Expo Router, utilizing native controls and views.

### How to Run:
1.  Open a terminal in the root directory and start the Expo builder:
    ```bash
    pnpm --filter @recall/mobile dev
    ```
    *(Alternatively, you can navigate directly to `apps/mobile/` and run `npx expo start --clear`)*.
2.  **device-connection (Tunnel):** If your local development machine and mobile device are on different network connections (or local firewalls block connections), start the server in tunnel mode:
    ```bash
    npx expo start --tunnel --clear
    ```

### How to Test:
1.  **Launch on Device:** Scan the QR code displayed in the terminal:
    *   **Android:** Scan using the **Expo Go** app.
    *   **iOS:** Scan using the system **Camera app** (which redirects to Expo Go).
2.  **Authentication:** Log in using the same email credentials you created on the web dashboard.
3.  **Stats Feed:** Navigate to the **Stats** tab. Verify it aggregates your total saved cards, action rates, and streaks cleanly without throwing exceptions.
4.  **Search:** Go to the **Search** tab and input a semantic query (e.g., search for *"developer tooling"* if you saved a HackerNews link). The app will query the Google Gemini embedding model and fetch the most relevant cards.

---

## 🧩 3. Chrome Browser Extension

The Chrome extension is a Manifest V3 bundle that fetches the title and URL of your active browser tab, detects the platform (YouTube, LinkedIn, TikTok, etc.), and saves it directly to your dashboard.

### How to Load the Extension:
1.  Open **Google Chrome** and navigate to `chrome://extensions/`.
2.  In the top-right corner, toggle **Developer mode** to **ON**.
3.  In the top-left corner, click the **Load unpacked** button.
4.  Navigate to your local repository directory and select the [extension/](file:///c:/Users/User/Desktop/Summer%20Break%202026/Summer-2026/RECALL/extension) folder.
5.  Pin the **Recall** icon (bookmark with flame symbol) to your Chrome toolbar.

### How to Test:
1.  **Authentication:** Click the Recall extension icon. Input your login credentials. Once verified, the popup will transition to the save view.
2.  **Save Tab:** Open any webpage (e.g., a YouTube tutorial, a Medium article, or Github repo).
3.  Click the extension icon. The popup will automatically capture:
    *   The page's Title.
    *   The page's URL.
    *   A preview of the content platform (e.g., YouTube logo if on YouTube).
4.  Type a personal note in the textarea and click **Save to Recall**.
5.  **Sync Check:** Open your Next.js dashboard at `http://localhost:3000` or the mobile client. Verify that the link has been saved and is processing in real-time!

---

## 🔧 Troubleshooting

### Port 8081 is Busy
If Expo fails to boot because port `8081` is already in use, you can free up the port or let Expo fallback to `8082`. To force kill the process occupying the port on Windows:
```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8081).OwningProcess -Force
```

### Edge Functions return 500 / Embeddings Fail
If the Edge Functions return a non-2xx status code when saving links or searching:
*   Ensure that your remote Supabase secrets are configured. 
*   Run the secret configuration command:
    ```bash
    supabase secrets set GEMINI_API_KEY=your_key GROQ_API_KEY=your_key
    ```
    *(Or configure them in **Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ Edge Functions $\rightarrow$ Environment Variables**).*

### DB RLS Constraint Failures on Link Addition
If the web client or extension throws an error (`Error adding link: {}`):
*   This occurs if your user account was registered prior to running migrations, meaning your profile row in `public.users` is missing.
*   **Resolution:** Run this backfill SQL query in your **Supabase SQL Editor** once:
    ```sql
    insert into public.users (id, email, display_name)
    select id, email, coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
    from auth.users
    on conflict (id) do nothing;
    ```
