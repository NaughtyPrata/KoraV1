# Vercel Deployment Checklist

## Pre-Deployment Steps ✅

1. **Environment Variables**
   - [ ] OPENAI_API_KEY set in Vercel dashboard
   - [ ] ELEVENLABS_API_KEY set in Vercel dashboard  
   - [ ] NEXT_PUBLIC_GLADIA_API_KEY set in Vercel dashboard
   - [ ] NEXT_PUBLIC_READYPLAYERME_AVATAR_ID (optional)
   - [ ] NEXT_PUBLIC_READYPLAYERME_AVATAR_URL (optional)

2. **Build Configuration**
   - [x] Removed "type": "module" from package.json
   - [x] Updated next.config.js with proper webpack config
   - [x] Created vercel.json for deployment settings
   - [x] Updated Next.js to latest stable version

3. **Code Quality**
   - [ ] Run `npm run build` locally to test
   - [ ] Check TypeScript compilation errors
   - [ ] Verify all imports are correct

## Deployment Commands

```bash
# Test build locally first
npm run build

# Deploy to Vercel
vercel --prod

# Or push to main branch if connected to GitHub
git add .
git commit -m "fix: deployment configuration"
git push origin main
```

## Common Error Solutions

### Build Errors
- **Module not found**: Check import paths and case sensitivity
- **TypeScript errors**: Run `npm run build` locally first
- **Webpack errors**: Check next.config.js webpack configuration

### Runtime Errors
- **API key errors**: Verify environment variables in Vercel dashboard
- **CORS errors**: Check vercel.json headers configuration
- **Audio/3D model loading**: Verify file paths and CORS settings

### Performance Issues
- **Function timeout**: Increase maxDuration in vercel.json (max 30s)
- **Memory issues**: Optimize 3D model sizes and textures
- **Cold starts**: Consider Vercel Pro for better performance

## Monitoring

After deployment, monitor:
- [ ] Vercel function logs
- [ ] Browser console for client errors
- [ ] API response times
- [ ] 3D model loading performance

## Troubleshooting

If deployment fails:
1. Check Vercel deployment logs
2. Verify all environment variables
3. Test build locally with `npm run build`
4. Check for console errors in browser
5. Verify API endpoints are working
