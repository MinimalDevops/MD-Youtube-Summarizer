chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes("youtube.com/watch")) {
    // Prevent duplicate downloads by disabling the action temporarily
    if (chrome.action._downloading) return;
    chrome.action._downloading = true;
    fetch(`http://localhost:5001/transcript?url=${encodeURIComponent(tab.url)}`)
      .then(response => response.json())
      .then(data => {
        if (data.transcript) {
          const filename = (data.title ? data.title : "transcript") + ".txt";
          const url = "data:text/plain," + encodeURIComponent(data.transcript);
          chrome.downloads.download({
            url: url,
            filename: filename
          }, (downloadId) => {
            chrome.action._downloading = false;
            if (downloadId) {
              // Show a notification when download starts
              chrome.notifications?.create({
                type: 'basic',
                iconUrl: 'MinimalDevopsLogo.png',
                title: 'Transcript Downloaded',
                message: `The transcript is being downloaded as ${filename}.`
              });
              console.log('Transcript download started, ID:', downloadId);
            } else {
              console.error('Download failed:', chrome.runtime.lastError);
              chrome.notifications?.create({
                type: 'basic',
                iconUrl: 'MinimalDevopsLogo.png',
                title: 'Download Failed',
                message: 'Could not start the transcript download.'
              });
            }
          });
        } else {
          chrome.action._downloading = false;
          console.error('Backend error:', data.error || 'Unknown error');
          chrome.notifications?.create({
            type: 'basic',
            iconUrl: 'MinimalDevopsLogo.png',
            title: 'Transcript Error',
            message: 'Failed to fetch transcript. Backend error: ' + (data.error || 'Unknown error')
          });
        }
      })
      .catch(err => {
        chrome.action._downloading = false;
        console.error('Fetch error:', err);
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: 'MinimalDevopsLogo.png',
          title: 'Transcript Error',
          message: 'Failed to fetch transcript. Is the backend running?'
        });
      });
  } else {
    console.warn('Not a YouTube video page:', tab.url);
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'MinimalDevopsLogo.png',
      title: 'Transcript Error',
      message: 'Not a YouTube video page!'
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download_transcript') {
    handleTranscriptDownload(request.url, request.summarize, request.model);
  }
});

function isYouTubeVideoUrl(url) {
  return url && (url.includes("youtube.com/watch") || url.includes("youtube.com/shorts"));
}

async function handleTranscriptDownload(tabUrl, summarize, model) {
  console.log('Requested transcript for:', tabUrl);
  if (!isYouTubeVideoUrl(tabUrl)) {
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'MinimalDevopsLogo.png',
      title: 'Transcript Error',
      message: 'Not a YouTube video or Shorts page!'
    });
    return;
  }
  try {
    console.log('Fetching transcript for:', tabUrl);
    const res = await fetch(`http://localhost:5001/transcript?url=${encodeURIComponent(tabUrl)}`);
    console.log('Transcript fetch response:', res);
    const data = await res.json();
    console.log('Transcript data:', data);
    if (!data.transcript) throw new Error(data.error || 'No transcript');
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
    if (summarize) {
      // Send transcript and model to backend for summarization
      console.log('Requesting summary for model:', model);
      const summaryRes = await fetch('http://localhost:5001/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.transcript, model })
      });
      console.log('Summary fetch response:', summaryRes);
      const summaryData = await summaryRes.json();
      console.log('Summary data:', summaryData);
      if (!summaryData.summary) throw new Error(summaryData.error || 'No summary');
      const summaryFilename = (data.title ? data.title : "transcript") + "_summary.txt";
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
  } catch (err) {
    console.error('Error:', err);
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'MinimalDevopsLogo.png',
      title: 'Transcript Error',
      message: err.message || 'Failed to download transcript.'
    });
  }
} 