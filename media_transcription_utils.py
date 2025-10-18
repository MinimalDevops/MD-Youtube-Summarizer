import os
import subprocess
import whisper
import ssl
import urllib.request
import imageio_ffmpeg as ffmpeg
import re
import time
import yt_dlp
import sys
from fpdf import FPDF
import requests
import asyncio

# Function to convert YouTube Shorts URL to standard URL
def convert_shorts_url(url):
    if "youtube.com/shorts/" in url:
        return re.sub(r"/shorts/", "/watch?v=", url)
    return url

# Function to download audio from YouTube with yt-dlp
def download_audio(youtube_url, output_path="audio.mp3"):
    try:
        print("Attempting to download audio from YouTube using yt-dlp...")
        # Remove existing audio file to avoid confusion
        if os.path.exists(output_path):
            os.remove(output_path)
        ydl_opts = {
            'format': 'worst[ext=m4a]/worst[ext=webm]/worst/best',
            'outtmpl': output_path.replace('.mp3', '') + '.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'nocheckcertificate': True,  # Bypass SSL certificate verification
            'ffmpeg_location': '/opt/homebrew/bin/ffmpeg',  # Use system ffmpeg
            'extract_flat': False,  # Ensure we extract the actual media
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
            'sleep_interval': 1,  # Add delay between requests
            'max_sleep_interval': 5,  # Maximum sleep time
            'socket_timeout': 30,  # Increase timeout
            'retries': 3,  # Retry failed downloads
            'fragment_retries': 3,  # Retry failed fragments
            'ignoreerrors': False,  # Don't ignore errors
            'no_warnings': False,  # Show warnings
            'extractor_retries': 3,  # Retry extractor failures
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(youtube_url, download=False)
            video_title = info_dict.get('title', 'video')
            sanitized_title = re.sub(r'[\\/*?\"<>|:…]', "", video_title)  # Remove invalid characters including colon and ellipsis
            ydl_opts['outtmpl'] = f"{sanitized_title}.%(ext)s"
            with yt_dlp.YoutubeDL(ydl_opts) as ydl_inner:
                ydl_inner.download([youtube_url])
            print(f"Audio successfully downloaded as {sanitized_title}.mp3")
            return f"{sanitized_title}.mp3", sanitized_title
    except Exception as e:
        print(f"An error occurred while downloading audio: {e}")
        return None, None

# Function to transcribe audio using whisper (ultra-simplified version)
def transcribe_audio(audio_path):
    try:
        # Set ffmpeg path
        os.environ["FFMPEG_BINARY"] = '/opt/homebrew/bin/ffmpeg'
        
        # Load whisper model and transcribe
        model = whisper.load_model("tiny")
        result = model.transcribe(audio_path)
        
        return result["text"]
    except Exception as e:
        print(f"Transcription error: {e}")
        return None

# Function to create a PDF from transcribed text
def create_pdf(transcription, pdf_path):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.multi_cell(0, 10, transcription)
    if not os.path.exists(os.path.dirname(pdf_path)):
        os.makedirs(os.path.dirname(pdf_path))
    pdf.output(pdf_path)
    print(f"PDF created at {pdf_path}")
    return pdf_path 