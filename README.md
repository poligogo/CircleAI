# CircleAI

An AI-powered Chrome extension for information security analysts to quickly analyze selected text and decode base64 strings.

## Features

- **AI Analysis**: Select any text on a webpage and get instant AI-powered security analysis
- **Base64 Decoding**: Automatically decode base64 strings with recursive decoding support
- **Multiple AI Providers**: Support for OpenAI, Google Gemini, Anthropic Claude, Grok (xAI), and custom APIs
- **Custom Models**: Support for custom model names for each provider
- **Security Focus**: Specifically designed for cybersecurity professionals
- **Modern UI**: Beautiful purple gradient theme with tech-inspired design

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the CircleAI folder
5. The extension should now appear in your extensions list

## Configuration

1. Click on the CircleAI extension icon in your browser toolbar
2. Select your preferred AI provider
3. Enter your API key
4. Choose a model or enter a custom model name
5. Configure temperature and max tokens as needed
6. Click "Save Settings"
7. Use "Test Connection" to verify your settings

## Usage

### AI Analysis
1. Select any text on a webpage
2. Click the "Ask AI" button that appears
3. View the AI analysis in the popup

### Base64 Decoding
1. Select a base64 encoded string
2. Click the "Decode" button that appears
3. View the decoded result with recursive decoding if applicable

## Supported AI Providers

- **OpenAI**: GPT models (requires OpenAI API key)
- **Google Gemini**: Latest Gemini 2.5 and 2.0 models (requires Google AI API key)
- **Anthropic**: Claude models (requires Anthropic API key)
- **Grok (xAI)**: Grok models (requires xAI API key)
- **Custom**: Any OpenAI-compatible API endpoint

## Testing

### Method 1: Using Local HTTP Server (Recommended)

1. Run the test server:
   ```bash
   python3 start_server.py
   ```
2. The browser will automatically open to `http://localhost:8000/test_page.html`
3. Test the extension functionality

### Method 2: Direct File Access

1. Open `test_page.html` directly in Chrome
2. **Important**: You may need to enable "Allow access to file URLs" for the CircleAI extension:
   - Go to `chrome://extensions/`
   - Find CircleAI extension
   - Click "Details"
   - Enable "Allow access to file URLs"

### Troubleshooting

If you see "Extension context invalidated" errors:

1. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Click the reload button for CircleAI
   - Refresh the test page

2. **Use HTTP server instead of file:// protocol**:
   - Use the provided `start_server.py` script
   - Or use any local HTTP server (Live Server, etc.)

3. **Check console for errors**:
   - Open Developer Tools (F12)
   - Check Console tab for error messages
   - Look for CircleAI debug messages

## API Configuration Examples

### OpenAI
- API Key: Your OpenAI API key
- Model: `gpt-4`, `gpt-3.5-turbo`, or custom model name

### Google Gemini
- API Key: Your Google AI API key
- Model: `gemini-2.5-flash`, `gemini-2.0-flash`, or custom model name

### Anthropic Claude
- API Key: Your Anthropic API key
- Model: `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307`, or custom model name

### Grok (xAI)
- API Key: Your xAI API key
- Model: `grok-beta`, `grok-vision-beta`, or custom model name

## Privacy

This extension only processes text that you explicitly select. No data is collected or stored by the extension itself. All API calls are made directly to your configured AI provider.

## License

MIT License