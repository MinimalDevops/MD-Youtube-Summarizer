from flask import Flask, request, jsonify
from flask_cors import CORS
import re
from media_transcription_utils import convert_shorts_url, download_audio
import os
import tempfile
import subprocess
import threading
import time
import whisper

app = Flask(__name__)
CORS(app)

# Global dictionary to store transcription status
transcription_status = {}

# Pre-load Whisper model at startup (much faster than loading on each request)
print("Loading Whisper model at startup...")
WHISPER_MODEL = whisper.load_model("tiny")
os.environ["FFMPEG_BINARY"] = '/opt/homebrew/bin/ffmpeg'
print("Whisper model loaded successfully!")

def cleanup_old_transcriptions():
    """Clean up old transcription statuses to prevent memory leaks"""
    current_time = time.time()
    to_remove = []
    for url, status in transcription_status.items():
        # Remove statuses older than 1 hour
        if 'timestamp' in status and current_time - status['timestamp'] > 3600:
            to_remove.append(url)
    for url in to_remove:
        del transcription_status[url]

def transcribe_audio_async(url, audio_path, sanitized_title):
    """Transcribe audio in a separate thread with cleanup"""
    try:
        print(f"Starting transcription for: {sanitized_title}")
        transcription_status[url] = {
            'status': 'transcribing', 
            'progress': 'Processing audio with Whisper...',
            'timestamp': time.time()
        }
        
        # Transcribe the downloaded audio using pre-loaded model (much faster!)
        result = WHISPER_MODEL.transcribe(audio_path)
        transcription = result["text"]
        
        if transcription:
            transcription_status[url] = {
                'status': 'completed', 
                'transcript': transcription, 
                'title': sanitized_title,
                'progress': 'Transcription completed!',
                'timestamp': time.time()
            }
            print(f"Transcription completed for: {sanitized_title}")
            
            # Clean up audio files after successful transcription
            try:
                if os.path.exists(audio_path):
                    os.remove(audio_path)
                    print(f"Cleaned up audio file: {audio_path}")
            except Exception as cleanup_error:
                print(f"Warning: Could not clean up audio file {audio_path}: {cleanup_error}")
        else:
            transcription_status[url] = {'status': 'error', 'error': 'Failed to transcribe audio'}
            print(f"Transcription failed for: {sanitized_title}")
            
            # Clean up audio files even on failure
            try:
                if os.path.exists(audio_path):
                    os.remove(audio_path)
                    print(f"Cleaned up failed audio file: {audio_path}")
            except Exception as cleanup_error:
                print(f"Warning: Could not clean up failed audio file {audio_path}: {cleanup_error}")
    except Exception as e:
        transcription_status[url] = {'status': 'error', 'error': str(e)}
        print(f"Transcription error for {sanitized_title}: {e}")
        
        # Clean up audio files on error
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
                print(f"Cleaned up audio file after error: {audio_path}")
        except Exception as cleanup_error:
            print(f"Warning: Could not clean up audio file {audio_path}: {cleanup_error}")

@app.route('/transcript', methods=['GET'])
def get_transcript():
    # Clean up old transcriptions
    cleanup_old_transcriptions()
    
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
        
        # Start transcription in a separate thread (non-blocking)
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
    # Clean up old transcriptions
    cleanup_old_transcriptions()
    
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