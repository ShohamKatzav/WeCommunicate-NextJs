# WeCommunicate

A real-time chat app built with Next.js. It supports one-to-one and group conversations, media and location sharing, voice and video calls, and offline use as an installable PWA. Production runs on Render.

## Features

- **Real-time messaging** — Socket.IO delivery, typing indicators, read receipts, and per-conversation drafts
- **Conversations** — Direct and group chats, replies, reactions, full-text search, an unread divider, and disappearing messages
- **Voice and video** — 1:1 WebRTC calls, plus voice messages with a playback progress bar
- **Media and location** — File uploads (images compressed in the browser), and current-location sharing with Google Maps
- **Profiles** — Avatar (upload, camera, or crop), about text, accent color, phone number, and email. Last seen is shown in chat
- **Safety** — Block another user, automatic content moderation, and a moderator page for bans and role changes
- **Auth** — Email or SMS one-time codes. Email is optional on the account
- **Appearance** — Light, dark, and system themes
- **PWA and offline** — Install prompt, Web Share Target, push notifications, an offline outbox, and local history that still works when a server call is slow or cut off

## Technologies

- **Next.js 16** and **React 19** (App Router, Server Actions)
- **TypeScript**
- **Tailwind CSS 4**
- **Socket.IO** for chat, presence, and call signaling
- **WebRTC** for 1:1 voice and video (Google STUN, optional TURN)
- **MongoDB** via Mongoose
- **Upstash Redis** for presence and rate limiting
- **Vercel Blob** for uploaded files
- **Brevo** for email and SMS
- **web-push** for notifications
- **OpenAI** for content moderation
- **Playwright** and **Allure** for end-to-end tests

## Installation

This repo uses pnpm (`pnpm-lock.yaml`; CI pins pnpm 10.25.0).

1. Clone the repository:

```bash
git clone https://github.com/ShohamKatzav/WeCommunicate-NextJs.git
cd WeCommunicate-NextJs
```

2. Install dependencies:

```bash
pnpm install
```

3. Create `.env.local` in the repo root. There is no `.env.example`; these are the variables `app/config/env.ts` requires:

```env
NEXT_PUBLIC_BASE_ADDRESS=<Public URL used to initialize the socket, including https>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<Google Maps API key>
NEXT_PUBLIC_MESSAGES_PER_PAGE=<Messages loaded per page; defaults to 30, minimum 5>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<Web Push VAPID public key>

JWT_SECRET_KEY=<At least 32 characters, used to sign auth tokens>
DB_URI=<MongoDB connection string>

BLOB_READ_WRITE_TOKEN=<Vercel Blob read/write token>
VERCEL_BLOB_CALLBACK_URL=<Public URL Vercel Blob calls when an upload finishes>

UPSTASH_REDIS_REST_URL=<Upstash Redis REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash Redis REST token>

BREVO_API_KEY=<Brevo API key>
SMTP_USER=<From address for email>
BREVO_SMS_SENDER=<SMS sender name, max 11 characters; defaults to WeCommunicate>

VAPID_PRIVATE_KEY=<Web Push VAPID private key>
OPENAI_API_KEY=<Used by content moderation>
```

Optional. Calls work on most home and mobile networks with STUN alone. Set all three to add a TURN relay for symmetric NATs and strict networks:

```env
TURN_URL=<Comma-separated TURN URLs>
TURN_USERNAME=<TURN username>
TURN_CREDENTIAL=<TURN credential>
```

`E2E_TEST` and `TEST_BYPASS_KEY` are only needed when running the Playwright suite.

4. Start the dev server. `pnpm dev` runs Next with experimental HTTPS:

```bash
pnpm dev
```

Open [https://localhost:3000](https://localhost:3000).

## Project structure

```
├── app/
│   ├── api/                 # Route handlers (file upload, clean history, web manifest)
│   ├── chat/                # Chat page and client
│   ├── components/
│   │   ├── auth/            # OTP / login UI
│   │   ├── chat/            # Thread, composer, calls, messages
│   │   ├── locations/       # Location sharing UI
│   │   ├── offline/         # Install prompt, outbox, service worker, push
│   │   ├── people/          # User lists
│   │   ├── profile/         # Avatar, crop, phone, email, accent
│   │   ├── shell/           # Navbar, footer, bottom prompts
│   │   └── ui/              # Shared controls (theme toggle, spinner, upload)
│   ├── config/              # Env schema and limits
│   ├── context/             # User, theme, socket, and prompt providers
│   ├── hooks/               # Chat, calls, offline, and message hooks
│   ├── lib/                 # Server actions (chat, profile, calls, push, moderation)
│   ├── profile/             # Own profile, edit, and public profile pages
│   └── utils/
├── socket/                  # Socket.IO auth, rate limit, and event handlers
├── models/                  # Mongoose schemas
├── repositories/            # Data access
├── services/                # Redis, push, moderation
├── pages/api/socket/        # Socket.IO server endpoint
├── public/                  # Service worker, offline page, icons
├── tests/                   # Playwright specs, page objects, and Allure output
└── types/
```

## Deployment

Live app: [https://wecommunicate-nextjs.onrender.com/](https://wecommunicate-nextjs.onrender.com/)

Pushes to `main` deploy on Render. The Playwright workflow then waits for that deploy and runs the e2e suite against production. Allure reports are published to the `gh-pages` branch.

## Scripts

```bash
pnpm dev            # HTTPS dev server
pnpm build          # Production build
pnpm start          # Production server
pnpm lint           # ESLint
pnpm test           # Playwright (sets E2E_TEST=true)
pnpm test-ui        # Playwright UI mode
pnpm test-debug     # Playwright inspector
pnpm allure:report  # Build the Allure HTML report from the last run
```

## Contributing

Pull requests are welcome.

## License

This project is licensed under the MIT License.

## Author

Shoham Katzav — [GitHub](https://github.com/ShohamKatzav)
