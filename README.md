# KORA - AI Talking Avatar

An interactive AI-powered talking avatar built with Next.js, ReadyPlayerMe, ElevenLabs, and OpenAI. KORA is a friendly library assistant at Bishan Library with natural speech, voice recognition, and expressive personality.

## ✨ Features

- **🎭 3D Avatar**: Realistic ReadyPlayerMe avatar with lip-sync and natural animations
- **🗣️ Voice Interaction**: Real-time voice recognition and natural speech synthesis
- **🧠 Smart Conversations**: OpenAI-powered responses with library-specific knowledge
- **💭 Thinking Bubbles**: Visual feedback with animated thinking expressions
- **💬 Comic Speech Bubbles**: Dynamic speech display with random arrow positioning
- **🎨 Modern UI**: Clean, responsive interface with glassmorphism effects

## 🚀 Live Demo

**Production**: [https://korav1.vercel.app](https://korav1.vercel.app)

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **3D Graphics**: Three.js, React Three Fiber
- **Avatar**: ReadyPlayerMe
- **Voice**: ElevenLabs TTS, Gladia STT
- **AI**: OpenAI GPT
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Environment variables (see setup)

## ⚙️ Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/NaughtyPrata/KoraV1.git
   cd KoraV1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment variables**
   Create a `.env.local` file:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   ELEVENLABS_API_KEY=your_elevenlabs_api_key
   GLADIA_API_KEY=your_gladia_api_key
   READYPLAYERME_AVATAR_URL=your_avatar_url
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:7471](http://localhost:7471)

## 🎯 Usage

1. **Text Chat**: Type messages in the input field
2. **Voice Chat**: Click the microphone button to enable voice input
3. **Avatar Interaction**: Watch KORA's expressions and lip-sync during conversations

## 🏗️ Project Structure

```
├── components/          # React components
│   ├── Avatar.tsx      # 3D avatar with animations
│   └── VoiceStreamer.tsx # Voice recognition
├── pages/              # Next.js pages
│   ├── index.tsx       # Main application
│   └── api/            # API endpoints
├── lib/                # Utilities and configurations
├── utils/              # Helper functions
├── public/             # Static assets
└── styles/             # CSS styles
```

## 🔧 Key Components

### Avatar System
- **3D Rendering**: Three.js with React Three Fiber
- **Lip Sync**: Real-time audio analysis for mouth movements
- **Animations**: Breathing, blinking, and natural head movements
- **Background**: Integrated 3D scene background

### Voice System
- **Speech-to-Text**: Gladia API for voice recognition
- **Text-to-Speech**: ElevenLabs for natural voice synthesis
- **Chunked Audio**: Optimized streaming for better performance

### UI Features
- **Thinking Bubbles**: 30+ random thinking expressions
- **Speech Bubbles**: Comic-style with dynamic arrow positioning
- **Status Indicators**: Real-time feedback for user interactions

## 🚀 Deployment

The project is configured for Vercel deployment:

```bash
npx vercel --prod
```

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for chat responses | Yes |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for speech synthesis | Yes |
| `GLADIA_API_KEY` | Gladia API key for speech recognition | Yes |
| `READYPLAYERME_AVATAR_URL` | ReadyPlayerMe avatar URL | Yes |

## 🎨 Customization

### Avatar
- Modify `READYPLAYERME_AVATAR_URL` to use different avatars
- Adjust animations in `components/Avatar.tsx`

### Personality
- Edit `prompt.md` to customize KORA's personality and responses
- Add thinking messages in `pages/index.tsx`

### Styling
- Modify speech bubble styles in the main component
- Adjust colors and animations in CSS

## 🐛 Troubleshooting

### Common Issues
- **Audio not working**: Check browser permissions for microphone
- **Avatar not loading**: Verify ReadyPlayerMe URL is valid
- **Voice recognition issues**: Ensure Gladia API key is correct

### Development
- Clear `.next` cache if experiencing build issues
- Check browser console for detailed error messages
- Verify all environment variables are set

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ for interactive AI experiences 