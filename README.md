# MD Youtube Summarizer

A Chrome extension to download and summarize YouTube video (and Shorts) transcripts using a local Python backend and Ollama for AI-powered summarization. **Now supports Instagram Reels and videos!**

Read the blog here -> [Chrome Extension with Local LLMs: Build Your Own YouTube Transcript Summarizer](https://medium.com/@minimaldevops/chrome-extensions-with-local-llms-build-your-own-youtube-transcript-summarizer-ba40141becd9)

## Features
- Download transcripts from YouTube videos, Shorts, and Instagram Reels with one click
- Optional AI-powered summarization using Ollama (local LLM)
- Customizable model selection for summarization
- Clean, modern popup UI
- Process management with PM2 for production deployment

## Requirements
- Python 3.8+
- Chrome browser
- [Ollama](https://ollama.com/) installed and running locally (for summarization)
- [FFmpeg](https://ffmpeg.org/) for audio processing
- [PM2](https://pm2.keymetrics.io/) for process management (optional but recommended)

## Quick Setup

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd <your-repo-directory>
```

### 2. Set up Python environment
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Install FFmpeg (macOS)
```bash
brew install ffmpeg
```

### 4. Start the backend server

#### Option A: Using PM2 (Recommended for production)
```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start the server with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs md-youtube-summarizer
```

#### Option B: Direct Python execution
```bash
source venv/bin/activate
python transcript_server.py
```

The server will run on **http://localhost:5003**

### 5. Load the Chrome extension
- Go to `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select the `chrome_extension` folder

## Usage
1. Go to any YouTube video, Shorts, or Instagram Reel page.
2. Click the **MD Youtube Summarizer** extension icon.
3. (Optional) Enable summarization and choose your Ollama model.
4. Click **Download Transcript**.
5. **Keep the popup open** until you see the download notification(s). Closing the popup early may interrupt the process.
6. If summarization is enabled, the transcript will be downloaded first, followed by the summary as a separate file.

## Available Ollama Models
The extension supports any Ollama model. Popular options include:
- `llama3.2:latest` (2.0 GB) - Fast and efficient
- `llama3.1:8b` (4.9 GB) - Balanced performance
- `gpt-oss:20b` (13 GB) - High quality but slower

## PM2 Management Commands
```bash
# View server status
pm2 status

# View logs
pm2 logs md-youtube-summarizer

# Restart server
pm2 restart md-youtube-summarizer

# Stop server
pm2 stop md-youtube-summarizer

# Start server
pm2 start md-youtube-summarizer

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Testing the Setup

### Test Backend API:
```bash
curl "http://localhost:5003/transcript?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### Test Summarization:
```bash
curl -X POST "http://localhost:5003/summarize" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your text here", "model": "llama3.2:latest"}'
```

## Customizing the Summarization Prompt
- By default, the backend uses the prompt: `Summarize this text:`
- To change the prompt, edit the `/summarize` endpoint in `transcript_server.py`:
  ```python
  prompt = "Summarize this text:"
  # Change this line to your desired prompt
  ```
- Save and restart the backend after making changes.

## Project Structure
```
MD-Youtube-Summarizer/
├── venv/                          # Python virtual environment
├── chrome_extension/              # Chrome extension files
│   ├── manifest.json             # Extension manifest
│   ├── popup.html                # Extension popup UI
│   ├── popup.js                  # Extension logic
│   └── background.js             # Background service worker
├── logs/                          # PM2 log files
├── ecosystem.config.js            # PM2 configuration
├── start_server.sh               # Server startup script
├── transcript_server.py          # Flask backend server
├── media_transcription_utils.py  # Core processing functions
└── requirements.txt              # Python dependencies
```

## Notes
- Summarization requires [Ollama](https://ollama.com/) to be installed and running locally.
- The backend must be running for the extension to work.
- The extension works for YouTube videos, Shorts, and Instagram Reels (public content only).
- **Summary size is limited by the model and Ollama's input constraints.** Very large transcripts may be truncated or fail to summarize.
- **FFmpeg** is required for audio processing. Ensure it's properly installed and accessible.
- **PM2** provides process management, auto-restart, and logging capabilities for production use.

## Troubleshooting

### Common Issues:
1. **FFmpeg not found**: Ensure FFmpeg is installed and in your PATH
2. **Port already in use**: The server runs on port 5003 by default
3. **Ollama not responding**: Make sure Ollama is running (`ollama serve`)
4. **Extension not working**: Check that the backend server is running

### Logs:
- PM2 logs: `pm2 logs md-youtube-summarizer`
- Direct server logs: Check console output when running `python transcript_server.py`

## Future Improvements
- Support for summarization using OpenRouter, OpenAI, or other cloud APIs in addition to Ollama.
- Allow editing the summarization prompt directly from the extension popup UI.
- Display warnings or handle cases where the transcript is too large for summarization.
- More advanced summary options (e.g., bullet points, custom length).
- Docker containerization for easier deployment.

## N8N Workflow (optional)
- The extension can trigger an n8n webhook for transcripts. Configure the webhook URL in `chrome_extension/config.js` under `n8nWebhookUrl`.
- In the popup UI, the **Use N8N workflow** checkbox is enabled by default. Disable it to fall back to the local Whisper backend.
- N8N responses: If your webhook returns a file/binary with `Content-Disposition: attachment; filename="..."`, the extension will download using that filename; JSON responses should include `transcript` (and optional `title`).
- N8N timeout: the extension waits up to 5 minutes for the n8n response; longer runs will abort client-side.
- To avoid committing secrets/endpoints, keep your real `n8nWebhookUrl` only in your local `chrome_extension/config.js` and commit a placeholder or example file instead.

## License

This project is licensed under the [MIT License](LICENSE). You are free to use, modify, and distribute it as you wish.
