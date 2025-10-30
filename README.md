# WeCommunicate

A modern real-time chat application built with Next.js, featuring group chats, file sharing, real-time notifications, and seamless deployment on Render.

## 🚀 Features

- **Real-time Messaging** - Instant message delivery via WebSocket connections
- **Group Chats** - Create and manage group conversations with multiple participants
- **File Sharing** - Upload and share files within conversations
- **Location Sharing** - Share your current location with Google Maps integration
- **Push Notifications** - Real-time notifications for new messages and updates
- **Modular Architecture** - Clean separation of concerns with dedicated handlers
- **Secure Authentication** - Built-in auth middleware for socket connections
- **Rate Limiting** - Protection against abuse with Upstash-powered rate limiting
- **Server Actions** - Modern Next.js server actions for efficient data handling
- **Optimized Proxy** - Custom proxy configuration for seamless routing

## 🛠️ Technologies Used

### Frontend
- **Next.js** - React framework for production
- **React** - UI component library
- **TypeScript** - Type-safe development

### Backend
- **Socket.IO** - Real-time bidirectional communication
- **Server Actions** - Next.js server-side operations
- **Custom Middleware** - Authentication and rate limiting

### Deployment
- **Render** - Cloud platform for deployment
- **Node.js** - Runtime environment

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/ShohamKatzav/WeCommunicate-NextJs.git
cd WeCommunicate-NextJs
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Add your environment variables:
```env
TOKEN_SECRET=<Secrete for signing user auth tokens>
DB_URI=<MongoDB connection string>

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<In order to access google maps api - create one on google cloud console>

UPSTASH_REDIS_REST_URL=<Private URL endpoint used to create connection to upstash -> upstash dashboard>
UPSTASH_REDIS_REST_TOKEN=<Token for upstash -> Upstash dashboard>

BLOB_READ_WRITE_TOKEN=<Token for Vercel blob from their dashboard>
VERCEL_BLOB_CALLBACK_URL=<Deployment URL (Public/Ngrok) for testing - vercel blob will update this url when file uploading done>

MESSAGES_PER_PAGE=<Number of messages to load per page (default 5)>
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
├── app/
│   ├── api/              # API routes (Send files route is here)
│   ├── components/       # React components
│   ├── hooks/            # Hooks allow easy access to main contexts (User, Socket and more)
│   ├── lib/              # Server actions
│   ├── socket/
│   │   ├── handlers/     # Socket event handlers
│   │   ├── middleware/   # Auth middleware
│   │   └── ratelimiter/  # Rate limiting logic
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript types
├── models/               # Mongodb schemas
├── repositories/         # DAL layer
└── public/               # Static assets
```

## 🚀 Deployment on Render

### Live Deployement

[https://wecommunicate-nextjs.onrender.com/](https://wecommunicate-nextjs.onrender.com/)

Connection Information for example:

- Username: Shoham@gmail.com
- Password: 12345678



## 🔧 Configuration

### Socket Configuration
Socket handlers are organized in `lib/socket/handlers/`. Each handler manages specific events and includes:
- Authentication checks via middleware
- Rate limiting per connection
- Error handling and validation

### Server Actions
API routes have been converted to server actions for better performance and type safety. Find them in `app/lib/`.

## 📝 Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

Your Name - [GitHub](https://github.com/ShohamKatzav)

---

Built with ❤️ using Next.js and deployed on Render