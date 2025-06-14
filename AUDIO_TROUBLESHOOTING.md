# Audio Troubleshooting Guide

## ✅ Recent Fixes Applied

- Fixed base64 audio data validation
- Corrected MIME type from WAV to MP3 (matching ElevenLabs output)
- Improved error handling for invalid audio data
- Updated audio initialization for better browser compatibility

## 🔧 Testing Your Deployment

**Production URL**: https://kora-v1-talking-avatar-kl2801sil-naughtypratas-projects.vercel.app

### Test Steps:
1. Open the app in your browser
2. Wait for the avatar to load (countdown should complete)
3. Type a message and click "Send"
4. Check if audio plays without errors

## 🐛 Common Issues & Solutions

### 1. Audio Still Not Playing
**Check browser console for errors**:
- Press F12 → Console tab
- Look for any red error messages
- If you see "API key not configured" - verify environment variables in Vercel

### 2. ElevenLabs API Issues
**Possible causes**:
- API key expired or invalid
- Rate limits exceeded
- Voice ID not found

**Debug steps**:
```javascript
// Check the API response in browser console
fetch('/api/speech', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Hello test' })
}).then(r => r.json()).then(console.log)
```

### 3. Audio Format Issues
**Fixed issues**:
- ✅ Base64 validation added
- ✅ MIME type corrected to audio/mpeg
- ✅ Empty audio data handling

### 4. Browser Compatibility
**Supported browsers**:
- Chrome (recommended)
- Firefox
- Safari
- Edge

**Chrome-specific optimizations**:
- Web Audio API for better performance
- Automatic AudioContext resume
- Enhanced lip sync support

## 🔍 Debug Commands

### Check API Endpoints
```bash
# Test chat API
curl -X POST https://your-app.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# Test speech API
curl -X POST https://your-app.vercel.app/api/speech \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world"}'
```

### Check Environment Variables
In Vercel dashboard:
1. Go to Settings → Environment Variables
2. Verify these are set:
   - ✅ OPENAI_API_KEY
   - ✅ ELEVENLABS_API_KEY
   - ✅ NEXT_PUBLIC_GLADIA_API_KEY

### Browser Console Debugging
```javascript
// Check if audio context is working
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
console.log('Audio context state:', audioContext.state);

// Test base64 audio data
const testData = 'your-base64-audio-data';
const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(testData);
console.log('Valid base64:', isValidBase64);
```

## 📱 Mobile Testing

### iOS Safari
- Requires user interaction to play audio
- May need to tap screen first
- Check for "NotAllowedError"

### Android Chrome
- Should work with Web Audio API
- Check microphone permissions for voice input

## 🚀 Performance Optimization

### Current Settings
- Function timeout: 30 seconds
- Audio format: MP3 (optimized for web)
- Compression: Enabled
- CDN: Automatic via Vercel

### Monitor Performance
- Check Vercel function logs
- Monitor API response times
- Watch for memory usage spikes

## 🔄 Quick Fixes

### If Audio Still Doesn't Work:
1. **Clear browser cache**
2. **Try incognito/private mode**
3. **Test on different browser**
4. **Check network connectivity**
5. **Verify API quotas not exceeded**

### Emergency Fallback:
If ElevenLabs fails, the app should show:
- Error message in status
- Continue to work for text-only chat
- Graceful degradation

## 📞 Support

If issues persist:
1. Check browser console for specific errors
2. Test API endpoints directly
3. Verify all environment variables
4. Check Vercel function logs
5. Monitor API usage/quotas

The audio system should now be much more robust and provide better error messages when issues occur.
