# Track your Rupee

A smart expense tracking app with glassmorphism UI, Google Sheets backend, and AI-powered data entry.

![Track your Rupee](https://img.shields.io/badge/Track_your_Rupee-💰-blue)

## Features

- 🎨 **Premium Glassmorphism UI** - Frosted glass effects, floating animations
- 🔐 **100% Client-Side** - No servers, your data stays in YOUR Google Sheet
- 📊 **Smart Dashboard** - Charts, insights, and spending meter
- ⚡ **AI Quick-Add** - Paste JSON from Gemini/ChatGPT to add expenses
- 🔄 **Auto-Sync** - Automatically finds your existing sheet across devices

## How It Works

1. **Sign in with Google** - One-click authentication (required)
2. **Auto-Setup** - App automatically creates or finds your expense sheet
3. **Track Expenses** - Use AI prompts to quickly add expenses
4. **View Insights** - See where your money goes with beautiful charts

## Tech Stack

- **React + Vite** - Fast, modern frontend
- **Google OAuth 2.0** - Secure authentication
- **Google Sheets API v4** - Your personal database
- **Chart.js** - Beautiful visualizations
- **Zustand** - Lightweight state management

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create a `.env` file:
```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Deployment

The app is automatically deployed to GitHub Pages on every push to main.

**Live URL:** https://pratikh6i.github.io/track-your-rupee/

## License

MIT
