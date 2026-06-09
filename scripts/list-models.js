const apiKey = process.env['GEMINI_API_KEY'] || '';
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  .then(res => res.json())
  .then(json => {
    console.log('Available models:');
    if (json.models) {
      json.models.forEach(m => console.log(`- ${m.name} (methods: ${m.supportedGenerationMethods})`));
    } else {
      console.log('No models returned. Response:', JSON.stringify(json, null, 2));
    }
  })
  .catch(err => console.error('Error:', err));
