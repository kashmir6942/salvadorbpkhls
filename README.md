# MPD to M3U8 Converter - Cloudflare Worker

A high-performance Cloudflare Worker that converts MPEG-DASH (MPD) streams with ClearKey DRM to HLS (M3U8) format, enabling seamless streaming on any HLS-compatible device or player.

## 🚀 Features

- **Real-time MPD to HLS conversion**: Automatically converts DASH manifests to HLS playlists
- **ClearKey DRM decryption**: Supports encrypted content with ClearKey protection
- **70+ Pre-configured channels**: Complete Cignal channel lineup ready to use
- **Global edge deployment**: Powered by Cloudflare Workers for worldwide performance
- **Universal compatibility**: Works with any HLS player (VLC, web browsers, mobile apps)
- **CORS enabled**: Ready for web applications and cross-origin requests

## 📺 Direct Streaming Links

Once deployed, you'll get direct streaming URLs like:

\`\`\`
One PH: https://your-worker.your-subdomain.workers.dev/hls/one-ph/playlist.m3u8
TV5: https://your-worker.your-subdomain.workers.dev/hls/tv5-hd/playlist.m3u8
HBO: https://your-worker.your-subdomain.workers.dev/hls/hbo/playlist.m3u8
NBA TV: https://your-worker.your-subdomain.workers.dev/hls/nba-tv/playlist.m3u8
\`\`\`

## 🛠 Quick Start

### 1. Deploy to Cloudflare Workers

\`\`\`bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Clone and deploy
git clone <your-repo>
cd mpd-to-m3u8-converter
wrangler deploy
\`\`\`

### 2. Get Your Streaming Links

Visit your worker URL to get all channel links:
\`\`\`
https://your-worker.your-subdomain.workers.dev/
\`\`\`

### 3. Start Streaming

Use any HLS player with the provided URLs!

## 📡 API Endpoints

| Endpoint | Description | Example |
|----------|-------------|---------|
| `GET /` | Channel list with direct links | Returns JSON with all streaming URLs |
| `GET /playlist.m3u8` | Master M3U8 playlist | All channels in one playlist |
| `GET /hls/{id}/playlist.m3u8` | Channel HLS playlist | Individual channel stream |
| `GET /segment/{id}/{path}` | Decrypted media segments | Proxied and decrypted content |

## 📋 Supported Channels

### 🎬 Entertainment (15+ channels)
- A2Z, One PH, TV5, Buko, Sari-Sari, Lotus Macau, tvUP, Thrill, AXN, Hits HD, Hits Now, IBC 13, TrueTV, TVN Premium, KBS World

### 🎭 Movies (8+ channels)  
- TVN Movies Pinoy, PBO, Viva Cinema, HBO, HBO Hits, HBO Family, HBO Signature, Cinemax

### ⚽ Sports (8+ channels)
- NBA TV Philippines, PBA Rush, One Sports HD, One Sports Plus, Premier Sports, Premier Sports 2, SpoTV HD, SpoTV 2 HD

### 👶 Kids (5+ channels)
- Animax, DreamWorks HD, Cartoon Network, Nickelodeon, Nick Jr

### 📰 News (6+ channels)
- PTV, RPTV, CNN International, BBC World News, Bloomberg, One News

### 🏠 Lifestyle (3+ channels)
- Lifetime, Food Network, HGTV

### 🌍 Documentary (4+ channels)
- History HD, Discovery Channel, Animal Planet, BBC Earth

## 🎥 Usage Examples

### Web Player (HLS.js)
\`\`\`html
<video id="video" controls></video>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
  const video = document.getElementById('video');
  const hls = new Hls();
  hls.loadSource('https://your-worker.workers.dev/hls/tv5-hd/playlist.m3u8');
  hls.attachMedia(video);
</script>
\`\`\`

### VLC Media Player
1. Open VLC
2. Media → Open Network Stream
3. Paste: `https://your-worker.workers.dev/hls/nba-tv/playlist.m3u8`

### Mobile Apps
Use the HLS URLs directly in any mobile video player that supports HLS streaming.

### IPTV Apps
Import the master playlist URL into your IPTV application:
\`\`\`
https://your-worker.workers.dev/playlist.m3u8
\`\`\`

## ⚙️ Configuration

### Adding New Channels

Edit `src/index.ts` and add to the `CHANNELS` object:

\`\`\`typescript
"your-channel-id": {
  name: "Channel Name",
  logo: "https://example.com/logo.png",
  group: "Entertainment",
  mpdUrl: "https://example.com/stream/index.mpd",
  clearKey: { 
    kid: "key_id_hex", 
    key: "key_hex" 
  },
}
\`\`\`

### Environment Variables

No environment variables required! All configuration is in the code.

## 🔧 Technical Details

### DRM Decryption
- **Algorithm**: AES-128-CTR decryption using Web Crypto API
- **Key Format**: Hex-encoded ClearKey KID and Key pairs
- **Compatibility**: Supports standard ClearKey DRM specification

### Format Conversion
- **MPD Parsing**: XML DOM parser for DASH manifest processing
- **HLS Generation**: Dynamic M3U8 playlist creation with proper timing
- **Segment Handling**: Real-time decryption and format conversion

### Performance Optimizations
- **Edge Caching**: Segments cached at 200+ Cloudflare locations
- **Lazy Loading**: Manifests and segments loaded on-demand
- **Connection Pooling**: Efficient upstream connections
- **Error Handling**: Graceful fallbacks for failed requests

## 🚨 Troubleshooting

### Common Issues

**"Channel not found" error**
- Check the channel ID in your URL matches the configured channels

**"Segment not found" error**  
- The upstream MPD stream may be offline or the segment expired

**Playback stuttering**
- Try a different quality variant or check your internet connection

**CORS errors in browser**
- The worker includes CORS headers, but some players may need additional configuration

### Debug Mode

Enable debug logging by checking browser console or Cloudflare Workers logs:
\`\`\`javascript
console.log("[v0] Debug message here");
\`\`\`

## 📄 Legal Notice

**Important**: This tool is for educational and personal use only. 

- Ensure you have proper rights and permissions for any content you stream
- Respect copyright laws and content licensing agreements  
- Do not use for commercial redistribution without proper licensing
- The authors are not responsible for misuse of this software

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📜 License

MIT License - see LICENSE file for details.

---

**Made with ❤️ for the streaming community**

*Enjoy your favorite channels anywhere, anytime!*
