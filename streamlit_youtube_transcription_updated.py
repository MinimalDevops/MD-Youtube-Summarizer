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
            'format': 'bestaudio/best',
            'outtmpl': output_path.replace('.mp3', '') + '.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'nocheckcertificate': True,  # Bypass SSL certificate verification
            'ffmpeg_location': ffmpeg.get_ffmpeg_exe(),  # Provide ffmpeg location from imageio_ffmpeg
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(youtube_url, download=False)
            video_title = info_dict.get('title', 'video')
            sanitized_title = re.sub(r'[\\/*?\"<>|]', "", video_title)  # Remove invalid characters
            ydl_opts['outtmpl'] = f"{sanitized_title}.%(ext)s"
            with yt_dlp.YoutubeDL(ydl_opts) as ydl_inner:
                ydl_inner.download([youtube_url])
            print(f"Audio successfully downloaded as {sanitized_title}.mp3")
            return f"{sanitized_title}.mp3", sanitized_title
    except Exception as e:
        print(f"An error occurred while downloading audio: {e}")
        return None, None

# Function to transcribe audio using whisper
def transcribe_audio(audio_path):
    wav_path = None
    try:
        print("Attempting to transcribe audio using Whisper...")
        # Add ffmpeg to PATH
        ffmpeg_path = ffmpeg.get_ffmpeg_exe()
        print(f"Using ffmpeg located at: {ffmpeg_path}")
        os.environ["PATH"] += os.pathsep + os.path.dirname(ffmpeg_path)
        os.environ["FFMPEG_BINARY"] = ffmpeg_path  # Set FFMPEG_BINARY environment variable explicitly
        # Convert audio to WAV format to ensure compatibility
        wav_path = audio_path.replace('.mp3', '.wav')
        if os.path.exists(wav_path):
            os.remove(wav_path)
        subprocess.run([ffmpeg_path, "-i", audio_path, wav_path], check=True)
        # Load whisper model
        model = whisper.load_model("base")
        # Transcribe audio
        result = model.transcribe(wav_path, fp16=False)  # Ensure FP16 is not used on CPU
        # print("Transcription:")
        # print(result["text"])
        return result["text"]
    except Exception as e:
        print(f"An error occurred during transcription: {e}")
        return None
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)
        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)

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

