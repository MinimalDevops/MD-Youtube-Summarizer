from flask import Flask, request, jsonify
from flask_cors import CORS
import re
from media_transcription_utils import convert_shorts_url, download_audio, transcribe_audio
import os
import tempfile
import subprocess
import threading
import time

app = Flask(__name__)
CORS(app)

# Global dictionary to store transcription status
transcription_status = {}

def transcribe_audio_async(url, audio_path, sanitized_title):
    """Transcribe audio in a separate thread"""
    try:
        print(f"Starting transcription for: {sanitized_title}")
        transcription_status[url] = {'status': 'transcribing', 'progress': 'Processing audio with Whisper...'}
        
        # Transcribe the downloaded audio
        transcription = transcribe_audio(audio_path)
        
        if transcription:
            transcription_status[url] = {
                'status': 'completed', 
                'transcript': transcription, 
                'title': sanitized_title,
                'progress': 'Transcription completed!'
            }
            print(f"Transcription completed for: {sanitized_title}")
        else:
            transcription_status[url] = {'status': 'error', 'error': 'Failed to transcribe audio'}
            print(f"Transcription failed for: {sanitized_title}")
    except Exception as e:
        transcription_status[url] = {'status': 'error', 'error': str(e)}
        print(f"Transcription error for {sanitized_title}: {e}")

@app.route('/transcript', methods=['GET'])
def get_transcript():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    # Check if transcription is already in progress or completed
    if url in transcription_status:
        status = transcription_status[url]
        if status['status'] == 'completed':
            return jsonify({
                'transcript': status['transcript'], 
                'title': status['title'],
                'status': 'completed'
            })
        elif status['status'] == 'transcribing':
            return jsonify({
                'status': 'processing',
                'progress': status.get('progress', 'Transcribing...'),
                'message': 'Transcription in progress. Please wait...'
            })
        elif status['status'] == 'error':
            return jsonify({'error': status['error']}), 500
    
    try:
        # Convert Shorts URL to standard URL if needed
        youtube_url = convert_shorts_url(url)
        
        # Set initial status
        transcription_status[url] = {'status': 'downloading', 'progress': 'Downloading audio...'}
        
        # Download audio from YouTube or Instagram
        audio_path, sanitized_title = download_audio(youtube_url)
        if not audio_path:
            transcription_status[url] = {'status': 'error', 'error': 'Failed to download audio'}
            return jsonify({'error': 'Failed to download audio'}), 500
        
        # Start transcription in a separate thread
        thread = threading.Thread(target=transcribe_audio_async, args=(url, audio_path, sanitized_title))
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'status': 'processing',
            'progress': 'Audio downloaded. Starting transcription...',
            'message': 'Transcription started. This may take several minutes for long videos.',
            'title': sanitized_title
        })
        
    except Exception as e:
        transcription_status[url] = {'status': 'error', 'error': str(e)}
        return jsonify({'error': str(e)}), 500

@app.route('/transcript/status', methods=['GET'])
def get_transcription_status():
    """Check the status of a transcription"""
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    if url not in transcription_status:
        return jsonify({'status': 'not_found', 'message': 'No transcription found for this URL'}), 404
    
    status = transcription_status[url]
    return jsonify(status)

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
    app.run(port=5003) 