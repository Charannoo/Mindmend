# 🧠 MindMend - Mental Wellness Tracker

> Your personal mental wellness companion for mood tracking, journaling, and AI-powered affirmations.

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-mindmend--w8f7.onrender.com-blue?style=for-the-badge)](https://mindmend-w8f7.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-Charannoo/Mindmend-black?style=for-the-badge&logo=github)](https://github.com/Charannoo/Mindmend)

---

## ✨ Features

- **📝 Daily Journaling** - Capture your thoughts and reflections
- **📊 Mood Tracking** - Visualize emotional patterns over time
- **✨ AI-Powered Affirmations** - Get personalized affirmations using OpenRouter AI
- **🔐 Secure Authentication** - Clerk-powered user management
- **☁️ Cloud Database** - Supabase PostgreSQL for reliable data storage
- **📱 Responsive Design** - Beautiful UI that works on all devices

---

## 🚀 Live Demo

**Try it now:** [https://mindmend-w8f7.onrender.com](https://mindmend-w8f7.onrender.com)

---

## 🛠️ Tech Stack

### Frontend

- **HTML5 / CSS3 / JavaScript** - Pure vanilla JS with modern features
- **Tailwind CSS** - Utility-first CSS framework (CDN)
- **Clerk** - Authentication & user management
- **Phosphor Icons** - Beautiful icon set

### Backend

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **Supabase** - PostgreSQL database

### APIs

- **OpenRouter** - AI affirmation generation

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/)
- **Supabase Account** - [Sign up here](https://supabase.com/) (free tier works)
- **Clerk Account** - [Sign up here](https://clerk.com/) (free tier works)

---

## 🔧 Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Charannoo/Mindmend.git
cd Mindmend
```

### 2. Set Up Supabase Database

1. Create a new project at [supabase.com](https://supabase.com/dashboard)
2. Go to **SQL Editor** → **New Query**
3. Copy contents from `supabase/schema.sql` and click **Run**
4. Go to **Project Settings** → **API**
   - Copy **Project URL** → Save as `SUPABASE_URL`
   - Copy **service_role** key → Save as `SUPABASE_SERVICE_ROLE_KEY`

### 3. Set Up Clerk Authentication

1. Create an application at [clerk.com](https://dashboard.clerk.com)
2. Go to **API Keys** section
   - Copy **Publishable Key** → `CLERK_PUBLISHABLE_KEY`
   - Copy **Secret Key** → `CLERK_SECRET_KEY`

### 4. Configure Environment Variables

Create `.env` file in the root directory:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# OpenRouter (Optional - for AI affirmations)
OPENROUTER_API_KEY=sk-or-v1-...

# App
BASE_URL=http://localhost:3000
PORT=3000
```

### 5. Install Dependencies & Run

```bash
cd Backend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

---

## 📂 Project Structure

```
MindMend/
├── Backend/
│   ├── server.js              # Express server & API routes
│   ├── package.json           # Node.js dependencies
│   └── package-lock.json
├── Frontend/
│   ├── index.html             # Main app (journal & mood tracker)
│   ├── login.html             # Clerk authentication page
│   ├── profile.html           # User profile page
│   ├── admin.html             # Admin dashboard
│   ├── auth.js                # Clerk authentication logic
│   ├── script.js              # Main app functionality
│   ├── style.css              # Custom styles
│   └── ...
├── supabase/
│   └── schema.sql             # Database schema
├── .env.example               # Environment template
├── Dockerfile
└── README.md                  # This file
```

---

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only) | ✅ Yes |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key (frontend) | ✅ Yes |
| `CLERK_SECRET_KEY` | Clerk secret key (backend) | ✅ Yes |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI affirmations | ❌ Optional |
| `BASE_URL` | Public URL of your app when deployed | ⚙️ Deploy only |
| `PORT` | Server port (default: 3000) | ❌ Optional |

See `DEPLOYMENT.md` for hosting notes.

---

## 📸 Screenshots

### Login Page

Modern sign-in interface with Clerk authentication.

### Journal & Mood Tracker

Intuitive interface for tracking moods and journaling.

### Admin Dashboard

Manage users and view all journal entries.

---

## 🐛 Troubleshooting

### "Database unavailable" error

- Verify Supabase URL and service role key in `.env`
- Ensure `supabase/schema.sql` has been run in Supabase SQL Editor
- Check if tables `user_profiles` and `journal_entries` exist

### Clerk authentication not working

- Verify publishable key in HTML files matches your Clerk app
- Add your domain to Clerk's **Allowed Origins**
- Check browser console (F12) for errors

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💬 Support

- **Issues:** [GitHub Issues](https://github.com/Charannoo/Mindmend/issues)
- **Live Demo:** [https://mindmend-w8f7.onrender.com](https://mindmend-w8f7.onrender.com)

---

## ⚡ Quick Links

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Clerk Dashboard](https://dashboard.clerk.com)
- [OpenRouter](https://openrouter.ai)

---

<div align="center">

**Made with ❤️ for mental wellness**

[![GitHub stars](https://img.shields.io/github/stars/Charannoo/Mindmend?style=social)](https://github.com/Charannoo/Mindmend/stargazers)

</div>
