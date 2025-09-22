#!/bin/bash

# MD YouTube Summarizer Server Startup Script

echo "Starting MD YouTube Summarizer Server..."

# Navigate to project directory (script should be run from project root)
# cd /path/to/MD-Youtube-Summarizer

# Activate virtual environment
source venv/bin/activate

# Check if Ollama is running
if ! pgrep -x "ollama" > /dev/null; then
    echo "Starting Ollama service..."
    ollama serve &
    sleep 3
fi

# Start the Flask server with PM2
echo "Starting Flask server with PM2..."
pm2 start ecosystem.config.js

# Show PM2 status
pm2 status

echo "Server started successfully!"
echo "Backend is running on http://localhost:5003"
echo ""
echo "To view logs: pm2 logs md-youtube-summarizer"
echo "To stop server: pm2 stop md-youtube-summarizer"
echo "To restart server: pm2 restart md-youtube-summarizer"
