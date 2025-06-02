document.getElementById('downloadBtn').addEventListener('click', async () => {
  const summarize = document.getElementById('summarizeToggle').checked;
  const model = document.getElementById('modelInput').value || 'llama3.2:1b';
  document.getElementById('downloadBtn').disabled = true;
  document.getElementById('downloadBtn').innerText = 'Processing...';

  // Get the current tab URL
  chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    const tab = tabs[0];
    const tabUrl = tab.url;
    function isYouTubeVideoUrl(url) {
      return url && (url.includes("youtube.com/watch") || url.includes("youtube.com/shorts"));
    }
    if (!isYouTubeVideoUrl(tabUrl)) {
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'MinimalDevopsLogo.png',
        title: 'Transcript Error',
        message: 'Not a YouTube video or Shorts page!'
      });
      document.getElementById('downloadBtn').disabled = false;
      document.getElementById('downloadBtn').innerText = 'Download Transcript';
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
    } finally {
      document.getElementById('downloadBtn').disabled = false;
      document.getElementById('downloadBtn').innerText = 'Download Transcript';
    }
  });
}); 