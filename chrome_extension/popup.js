// Function to poll for transcription status
async function pollTranscriptionStatus(tabUrl, maxAttempts = 60) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const res = await fetch(`http://localhost:5003/transcript/status?url=${encodeURIComponent(tabUrl)}`);
      const data = await res.json();
      
      if (data.status === 'completed') {
        return data;
      } else if (data.status === 'error') {
        throw new Error(data.error || 'Transcription failed');
      } else if (data.status === 'transcribing' || data.status === 'processing') {
        // Update progress message
        document.getElementById('downloadBtn').innerText = data.progress || 'Processing...';
        console.log('Transcription progress:', data.progress);
        
        // Wait 5 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      } else {
        throw new Error('Unknown transcription status');
      }
    } catch (err) {
      if (attempts >= maxAttempts - 1) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
  }
  
  throw new Error('Transcription timeout - please try again');
}

document.getElementById('downloadBtn').addEventListener('click', async () => {
  const summarize = document.getElementById('summarizeToggle').checked;
  const model = document.getElementById('modelInput').value || 'llama3.2:1b';
  document.getElementById('downloadBtn').disabled = true;
  document.getElementById('downloadBtn').innerText = 'Starting...';

  // Get the current tab URL
  chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    const tab = tabs[0];
    const tabUrl = tab.url;
    
    function isSupportedVideoUrl(url) {
      return (
        (url.includes("youtube.com/watch") || url.includes("youtube.com/shorts")) ||
        url.includes("instagram.com/reel/")
      );
    }
    
    if (!isSupportedVideoUrl(tabUrl)) {
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'MinimalDevopsLogo.png',
        title: 'Transcript Error',
        message: 'Not a supported video page!'
      });
      document.getElementById('downloadBtn').disabled = false;
      document.getElementById('downloadBtn').innerText = 'Download Transcript';
      return;
    }
    
    try {
      console.log('Starting transcription for:', tabUrl);
      
      // Start the transcription process
      const res = await fetch(`http://localhost:5003/transcript?url=${encodeURIComponent(tabUrl)}`);
      const data = await res.json();
      
      if (data.status === 'processing') {
        console.log('Transcription started, polling for completion...');
        document.getElementById('downloadBtn').innerText = data.progress || 'Processing...';
        
        // Show notification about long processing time
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: 'MinimalDevopsLogo.png',
          title: 'Transcription Started',
          message: 'Processing video. This may take several minutes for long videos. Please keep this popup open.'
        });
        
        // Poll for completion
        const result = await pollTranscriptionStatus(tabUrl);
        
        // Download transcript
        const filename = (result.title ? result.title : "transcript") + ".txt";
        const url = "data:text/plain," + encodeURIComponent(result.transcript);
        chrome.downloads.download({ url, filename }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('Download API error:', chrome.runtime.lastError);
          } else {
            chrome.notifications?.create({
              type: 'basic',
              iconUrl: 'MinimalDevopsLogo.png',
              title: 'Transcript Downloaded',
              message: `The transcript is being downloaded as ${filename}.`
            });
            console.log('Transcript download started, ID:', downloadId);
          }
        });
        
        // Handle summarization if requested
        if (summarize) {
          document.getElementById('downloadBtn').innerText = 'Generating summary...';
          console.log('Requesting summary for model:', model);
          const summaryRes = await fetch('http://localhost:5003/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: result.transcript, model })
          });
          const summaryData = await summaryRes.json();
          
          if (!summaryData.summary) throw new Error(summaryData.error || 'No summary');
          
          const summaryFilename = (result.title ? result.title : "transcript") + "_summary.txt";
          const summaryUrl = "data:text/plain," + encodeURIComponent(summaryData.summary);
          chrome.downloads.download({ url: summaryUrl, filename: summaryFilename }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error('Download API error (summary):', chrome.runtime.lastError);
            } else {
              chrome.notifications?.create({
                type: 'basic',
                iconUrl: 'MinimalDevopsLogo.png',
                title: 'Summary Downloaded',
                message: `The summary is being downloaded as ${summaryFilename}.`
              });
              console.log('Summary download started, ID:', downloadId);
            }
          });
        }
        
      } else if (data.transcript) {
        // Immediate completion (cached result)
        const filename = (data.title ? data.title : "transcript") + ".txt";
        const url = "data:text/plain," + encodeURIComponent(data.transcript);
        chrome.downloads.download({ url, filename }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('Download API error:', chrome.runtime.lastError);
          } else {
            chrome.notifications?.create({
              type: 'basic',
              iconUrl: 'MinimalDevopsLogo.png',
              title: 'Transcript Downloaded',
              message: `The transcript is being downloaded as ${filename}.`
            });
            console.log('Transcript download started, ID:', downloadId);
          }
        });
      } else {
        throw new Error(data.error || 'No transcript');
      }
      
    } catch (err) {
      console.error('Error:', err);
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'MinimalDevopsLogo.png',
        title: 'Transcript Error',
        message: err.message || 'Failed to download transcript.'
      });
    } finally {
      document.getElementById('downloadBtn').disabled = false;
      document.getElementById('downloadBtn').innerText = 'Download Transcript';
    }
  });
}); 