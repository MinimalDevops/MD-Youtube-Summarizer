// Function to poll for transcription status
async function pollTranscriptionStatus(tabUrl, maxAttempts = 60) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const res = await fetch(buildBackendUrl(`/transcript/status?url=${encodeURIComponent(tabUrl)}`));
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

function downloadTextFile(text, filename) {
  const url = "data:text/plain," + encodeURIComponent(text);
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
}

function downloadBlobFile(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  chrome.downloads.download({ url: objectUrl, filename }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Download API error (blob):', chrome.runtime.lastError);
    } else {
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'MinimalDevopsLogo.png',
        title: 'Transcript Downloaded',
        message: `The transcript is being downloaded as ${filename}.`
      });
      console.log('Transcript download started, ID:', downloadId);
    }
    // Release object URL after Chrome finishes grabbing it
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  });
}

function parseFilenameFromHeader(contentDisposition) {
  if (!contentDisposition) return null;
  // Try RFC 5987 format first: filename*=UTF-8''name.txt
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (e) {
      return utf8Match[1];
    }
  }
  // Fallback: filename="name.txt" or filename=name.txt
  const asciiMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  if (asciiMatch && asciiMatch[1]) return asciiMatch[1];
  return null;
}

async function fetchTranscriptFromN8n(tabUrl) {
  if (!CONFIG.n8nWebhookUrl) {
    throw new Error('N8N webhook URL is not configured.');
  }

  // Abort if N8N takes longer than 5 minutes
  const controller = new AbortController();
  const n8nTimeoutMs = 5 * 60 * 1000;
  const timeoutId = setTimeout(() => controller.abort(), n8nTimeoutMs);

  const response = await fetch(CONFIG.n8nWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: tabUrl }),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`N8N request failed (${response.status}): ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const disposition = response.headers.get('content-disposition') || '';
  const filename = parseFilenameFromHeader(disposition) || 'transcript.txt';

  if (contentType.includes('application/json')) {
    const json = await response.json();
    const transcript = json.transcript || json.text || json.data || json.body;
    const title = json.title;
    if (!transcript) {
      throw new Error('No transcript found in N8N response.');
    }
    return { transcript, title, filename };
  }

  // Non-JSON: assume file/binary response; keep blob for download
  const blob = await response.blob();
  let transcriptText = null;
  try {
    // Many transcript files are plain text; capture text for summarization if possible
    transcriptText = await blob.text();
  } catch (e) {
    transcriptText = null;
  }

  return { blob, transcript: transcriptText, title: null, filename };
}

document.getElementById('downloadBtn').addEventListener('click', async () => {
  const summarize = document.getElementById('summarizeToggle').checked;
  const model = document.getElementById('modelInput').value || 'llama3.2:1b';
  const useN8n = document.getElementById('n8nToggle').checked;
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

      if (useN8n && CONFIG.n8nWebhookUrl && CONFIG.n8nWebhookUrl.trim()) {
        document.getElementById('downloadBtn').innerText = 'Triggering n8n...';
        const n8nResult = await fetchTranscriptFromN8n(tabUrl);
        const n8nFilename = n8nResult.filename || (n8nResult.title ? n8nResult.title + ".txt" : "transcript.txt");

        if (n8nResult.blob) {
          downloadBlobFile(n8nResult.blob, n8nFilename);
        } else if (n8nResult.transcript) {
          downloadTextFile(n8nResult.transcript, n8nFilename);
        } else {
          throw new Error('N8N response missing transcript content.');
        }

        if (summarize) {
          document.getElementById('downloadBtn').innerText = 'Generating summary...';
          // Use transcript text if available; otherwise attempt to read from blob
          let textForSummary = n8nResult.transcript;
          if (!textForSummary && n8nResult.blob) {
            try {
              textForSummary = await n8nResult.blob.text();
            } catch (e) {
              console.warn('Unable to read blob text for summarization', e);
            }
          }
          if (!textForSummary) {
            throw new Error('Cannot summarize: no transcript text available from N8N response.');
          }

          const summaryRes = await fetch(buildBackendUrl('/summarize'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textForSummary, model })
          });
          const summaryData = await summaryRes.json();
          
          if (!summaryData.summary) throw new Error(summaryData.error || 'No summary');
          
          const summaryFilename = (n8nResult.title ? n8nResult.title : "transcript") + "_summary.txt";
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
      } else {
        if (useN8n) {
          chrome.notifications?.create({
            type: 'basic',
            iconUrl: 'MinimalDevopsLogo.png',
            title: 'N8N not configured',
            message: 'Set n8nWebhookUrl in config.js or uncheck Use N8N.'
          });
          console.warn('N8N selected but n8nWebhookUrl is empty; falling back to local backend.');
        }

        // Start the transcription process via local backend
        const res = await fetch(buildBackendUrl(`/transcript?url=${encodeURIComponent(tabUrl)}`));
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
          downloadTextFile(result.transcript, filename);
          
          // Handle summarization if requested
          if (summarize) {
            document.getElementById('downloadBtn').innerText = 'Generating summary...';
            console.log('Requesting summary for model:', model);
            const summaryRes = await fetch(buildBackendUrl('/summarize'), {
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
          downloadTextFile(data.transcript, filename);
        } else {
          throw new Error(data.error || 'No transcript');
        }
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
