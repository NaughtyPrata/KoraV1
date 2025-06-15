# Avatar Configuration

## Environment Variables Setup

To easily change the avatar model, create a `.env.local` file in the root directory with:

```bash
# ReadyPlayerMe Avatar Configuration
# Change this URL to any ReadyPlayerMe avatar model you want to use
NEXT_PUBLIC_READYPLAYERME_AVATAR_URL=https://models.readyplayer.me/684ad1642c774db868c4d89e.glb

# API Keys (replace with your actual keys)
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# ReadyPlayerMe Configuration (optional)
READYPLAYERME_SUBDOMAIN=kora
READYPLAYERME_APP_ID=your_app_id_here
READYPLAYERME_ORG_ID=your_org_id_here
READYPLAYERME_API_KEY=your_readyplayerme_api_key_here
```

## How to Change Avatar

1. Create a `.env.local` file in the project root
2. Add the `NEXT_PUBLIC_READYPLAYERME_AVATAR_URL` variable with your desired avatar URL
3. Restart the development server with `./startup.sh`

## Current Avatar

The current avatar URL is: `https://models.readyplayer.me/684ad1642c774db868c4d89e.glb`

If no environment variable is set, this will be used as the default.

## Note

- Environment variables starting with `NEXT_PUBLIC_` are accessible in the browser
- The `.env.local` file is ignored by git for security
- Restart the server after changing environment variables 