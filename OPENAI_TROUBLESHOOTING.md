# OpenAI/ChatGPT Troubleshooting Guide

## 🚀 Latest Deployment
**Production URL**: https://kora-v1-talking-avatar-mi204oa3g-naughtypratas-projects.vercel.app

## 🔧 Debugging Steps

### 1. Check Environment Variables
Visit: `https://kora-v1-talking-avatar-mi204oa3g-naughtypratas-projects.vercel.app/api/debug`

This will show you:
- If OPENAI_API_KEY exists and its format
- If other API keys are properly configured
- Environment information

### 2. Test OpenAI Connection
Visit: `https://kora-v1-talking-avatar-mi204oa3g-naughtypratas-projects.vercel.app/api/test-openai`

This will:
- Test direct OpenAI API connection
- Show detailed error messages
- Validate API key format

### 3. Common OpenAI Issues

#### ❌ **Invalid API Key**
- **Error**: "OpenAI API key is invalid or expired"
- **Solution**: Check if your OpenAI API key starts with `sk-` and is valid
- **Check**: Go to https://platform.openai.com/api-keys to verify

#### ❌ **Rate Limits**  
- **Error**: "OpenAI API rate limit exceeded"
- **Solution**: Wait a few minutes or upgrade your OpenAI plan
- **Check**: https://platform.openai.com/usage to see your usage

#### ❌ **No API Key**
- **Error**: "OpenAI API key not configured"
- **Solution**: Set OPENAI_API_KEY in Vercel environment variables
- **Location**: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

#### ❌ **Connection Issues**
- **Error**: "Unable to connect to OpenAI service"
- **Solution**: Check if OpenAI services are down at https://status.openai.com/

#### ❌ **Model Issues**
- **Error**: Model not found or unavailable
- **Solution**: We're using `gpt-4o-mini` which should be available to all users

### 4. Environment Variable Setup

In your Vercel dashboard, ensure you have:

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_GLADIA_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Important**: 
- Make sure there are no extra spaces
- The OpenAI key must start with `sk-`
- Set for Production, Preview, AND Development environments

### 5. Testing Flow

1. **Open the app** → Should load with countdown
2. **Wait for avatar** → Should show "Ready" status  
3. **Type a message** → Should show "Thinking..." then "Generating speech..."
4. **Check browser console** → Look for any error messages

### 6. Browser Console Debugging

Open Developer Tools (F12) and look for:

```javascript
// Good logs (working):
"=== Chat API Request ==="
"API Key exists: true"
"Messages received: 1" 
"Calling generateResponse..."
"Response generated successfully: true"

// Bad logs (not working):
"OpenAI API key not found or empty"
"OpenAI API error details: {...}"
```

### 7. Manual API Test

You can test the chat API directly:

```javascript
// In browser console:
fetch('/api/chat', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    messages: [{role: 'user', content: 'Hello'}]
  })
}).then(r => r.json()).then(console.log)
```

### 8. Improved Error Handling

The latest deployment includes:
- ✅ Better error messages for specific OpenAI issues
- ✅ API key validation before making requests  
- ✅ Detailed logging for debugging
- ✅ Timeout handling (30 seconds)
- ✅ Retry logic (3 attempts)

### 9. Quick Fixes

#### If chat still doesn't work:

1. **Verify OpenAI API Key**:
   - Go to https://platform.openai.com/api-keys
   - Create a new key if needed
   - Copy it exactly (no extra spaces)
   - Update in Vercel environment variables

2. **Check OpenAI Account**:
   - Ensure you have available credits
   - Check if your account is in good standing
   - Verify no rate limits are active

3. **Redeploy**:
   ```bash
   vercel --prod
   ```

4. **Clear Browser Cache**:
   - Hard refresh (Ctrl+Shift+R)
   - Try incognito mode

### 10. Support Endpoints

Use these URLs to debug:
- Environment check: `/api/debug`
- OpenAI test: `/api/test-openai`  
- Direct chat test: `/api/chat` (POST with messages)

## 🆘 Still Not Working?

If ChatGPT is still not responding:

1. Check the `/api/debug` endpoint first
2. Verify your OpenAI API key is valid and has credits
3. Look at Vercel function logs in your dashboard
4. Check browser console for specific error messages
5. Try the `/api/test-openai` endpoint for detailed diagnostics

The improved error handling should now give you much clearer information about what's going wrong!
