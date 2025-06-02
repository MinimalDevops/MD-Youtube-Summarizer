# MD Youtube Summarizer

A Chrome extension to download and summarize YouTube video (and Shorts) transcripts using a local Python backend and Ollama for AI-powered summarization.

## Features
- Download transcripts from YouTube videos and Shorts with one click
- Optional AI-powered summarization using Ollama (local LLM)
- Customizable model selection for summarization
- Clean, modern popup UI

## Requirements
- Python 3.8+
- Chrome browser
- [Ollama](https://ollama.com/) installed and running locally (for summarization)
- [chromedriver](https://sites.google.com/chromium.org/driver/) (must match your Chrome version)

## Setup

### 1. Clone the repository
```
git clone <your-repo-url>
cd <your-repo-directory>
```

### 2. Install Python dependencies
```
pip install -r requirements.txt
```

### 3. Download and Install Chromedriver
- Download the correct version of [chromedriver](https://sites.google.com/chromium.org/driver/) for your Chrome browser.
- Place the `chromedriver` executable in your project directory or ensure it is in your system PATH.
- Make sure the version matches your installed Chrome browser version.

### 4. Start the backend server
```
python transcript_server.py
```

### 5. Load the Chrome extension
- Go to `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select the `chrome_extension` folder

## Usage
1. Go to any YouTube video or Shorts page.
2. Click the **MD Youtube Summarizer** extension icon.
3. (Optional) Enable summarization and choose your Ollama model.
4. Click **Download Transcript**.
5. **Keep the popup open** until you see the download notification(s). Closing the popup early may interrupt the process.
6. If summarization is enabled, the transcript will be downloaded first, followed by the summary as a separate file.

## Customizing the Summarization Prompt
- By default, the backend uses the prompt: `Summarize this text:`
- To change the prompt, edit the `/summarize` endpoint in `transcript_server.py`:
  ```python
  prompt = "Summarize this text:"
  # Change this line to your desired prompt
  ```
- Save and restart the backend after making changes.

## Notes
- Summarization requires [Ollama](https://ollama.com/) to be installed and running locally.
- The backend must be running for the extension to work.
- The extension works for both regular YouTube videos and Shorts.
- **Summary size is limited by the model and Ollama's input constraints.** Very large transcripts may be truncated or fail to summarize.
- **Chromedriver** is required for some YouTube download operations. Ensure it matches your Chrome version.

## Future Improvements
- Support for summarization using OpenRouter, OpenAI, or other cloud APIs in addition to Ollama.
- Allow editing the summarization prompt directly from the extension popup UI.
- Display warnings or handle cases where the transcript is too large for summarization.
- More advanced summary options (e.g., bullet points, custom length).

## License
MIT 