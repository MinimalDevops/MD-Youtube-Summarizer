const CONFIG = {
  backendBaseUrl: 'http://localhost:5003',
  // Update to your n8n webhook endpoint. Example: 'https://n8n.example.com/webhook/you-insta-transcribe'
  n8nWebhookUrl: ''
};

function buildBackendUrl(path) {
  return `${CONFIG.backendBaseUrl}${path}`;
}
