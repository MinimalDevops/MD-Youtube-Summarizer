from flask import Flask, request, jsonify
from flask_cors import CORS
import re
from streamlit_youtube_transcription_updated import convert_shorts_url, download_audio, transcribe_audio
import os
import tempfile
import subprocess

app = Flask(__name__)
CORS(app)

@app.route('/transcript', methods=['GET'])
def get_transcript():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    # Convert Shorts URL to standard URL if needed
    youtube_url = convert_shorts_url(url)
    # Download audio from YouTube
    audio_path, sanitized_title = download_audio(youtube_url)
    if not audio_path:
        return jsonify({'error': 'Failed to download audio'}), 500
    # Transcribe the downloaded audio
    transcription = transcribe_audio(audio_path)
    if not transcription:
        return jsonify({'error': 'Failed to transcribe audio'}), 500
    return jsonify({'transcript': transcription, 'title': sanitized_title})

@app.route('/summarize', methods=['POST'])
def summarize():
    data = request.get_json()
    text = data.get('text')
    model = data.get('model', 'llama3.2:1b')
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    try:
        with tempfile.NamedTemporaryFile('w+', delete=False) as f:
            f.write(text)
            f.flush()
            input_path = f.name
        prompt = "Summarize this text:"
        cmd = f'ollama run {model} "{prompt}" < "{input_path}"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        os.unlink(input_path)
        if result.returncode != 0:
            return jsonify({'error': result.stderr.strip()}), 500
        return jsonify({'summary': result.stdout.strip()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001) 