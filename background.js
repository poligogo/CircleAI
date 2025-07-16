// background.js

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('CircleAI Background: Received message:', request);
    
    if (request.type === 'TEST_CONNECTION') {
        console.log('CircleAI Background: Handling TEST_CONNECTION request');
        handleTestConnection(request.settings, sendResponse);
        return true; // Keep the message channel open for async response
    }
    
    // Safety check for sender.tab (only for content script messages)
    if (!sender.tab || !sender.tab.id) {
        console.error('CircleAI Background: Invalid sender tab information');
        sendResponse({ success: false, error: 'Invalid tab context' });
        return false;
    }
    
    const tabId = sender.tab.id;
    
    if (request.type === 'ASK_AI') {
        console.log('CircleAI Background: Handling ASK_AI request');
        handleAIRequest(request.text, tabId);
    } else if (request.type === 'DECODE_BASE64') {
        console.log('CircleAI Background: Handling DECODE_BASE64 request');
        handleBase64Decode(request.text, tabId);
    } else {
        console.log('CircleAI Background: Unknown message type:', request.type);
    }
    // Indicate that the response will be sent asynchronously
    return true; 
});

// Function to handle AI requests
async function handleAIRequest(text, tabId) {
  try {
    const result = await chrome.storage.sync.get([
      'apiProvider', 'apiKey', 'model', 'customUrl', 'openaiCompatible',
      'temperature', 'maxTokens'
    ]);
    
    const settings = {
      apiProvider: result.apiProvider || 'openai',
      apiKey: result.apiKey,
      model: result.model,
      customUrl: result.customUrl,
      openaiCompatible: result.openaiCompatible,
      temperature: parseFloat(result.temperature) || 0.7,
      maxTokens: parseInt(result.maxTokens) || 1000
    };

    if (!settings.apiKey) {
      throw new Error('API key not configured. Please set it in the extension popup.');
    }

    let response;
    switch (settings.apiProvider) {
      case 'openai':
        response = await callOpenAI(text, settings);
        break;
      case 'gemini':
        response = await callGemini(text, settings);
        break;
      case 'anthropic':
        response = await callAnthropic(text, settings);
        break;
      case 'grok':
        response = await callGrok(text, settings);
        break;
      case 'custom':
        response = await callCustomAPI(text, settings);
        break;
      default:
        throw new Error('Unknown API provider');
    }

    // Send message with error handling
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_RESULT',
        result: response,
        resultType: 'ai'
      });
    } catch (sendError) {
      console.error('CircleAI: Failed to send AI response to tab:', sendError);
    }
  } catch (error) {
    console.error('CircleAI: AI request error:', error);
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_RESULT',
        result: `Error: ${error.message}`,
        resultType: 'error'
      });
    } catch (sendError) {
      console.error('CircleAI: Failed to send error message to tab:', sendError);
    }
  }
}

// A more robust Base64 decoding function that handles UTF-8 characters
function b64DecodeUnicode(str) {
    try {
        // Attempt to decode URI components after base64 decoding to handle UTF-8.
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    } catch (e) {
        // If decodeURIComponent fails, it might not be a UTF-8 string.
        // Fallback to simple atob for binary data or other encodings.
        try {
            return atob(str);
        } catch (e2) {
            // If atob also fails, the string is invalid.
            throw new Error('Invalid Base64 string.');
        }
    }
}

// Helper function to check if a string is valid Base64
function isBase64(str) {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}

// Function to handle Base64 decoding
async function handleBase64Decode(text, tabId) {
  try {
    const decoded = b64DecodeUnicode(text.trim());
    
    // Check if the result is still Base64 encoded (recursive decoding)
    let finalResult = decoded;
    let decodingSteps = [text.trim()];
    let currentText = decoded;
    let maxIterations = 5; // Prevent infinite loops
    
    while (maxIterations > 0 && isBase64(currentText)) {
      try {
        const nextDecoded = b64DecodeUnicode(currentText);
        if (nextDecoded === currentText) break; // No change, stop
        decodingSteps.push(currentText);
        currentText = nextDecoded;
        finalResult = nextDecoded;
        maxIterations--;
      } catch (e) {
        break; // Stop if decoding fails
      }
    }
    
    decodingSteps.push(finalResult);
    
    let resultMessage = `Decoded Result:\n${finalResult}`;
    if (decodingSteps.length > 2) {
      resultMessage += `\n\nDecoding Steps:\n${decodingSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
    }
    
    // Send message with error handling
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_RESULT',
        result: resultMessage,
        resultType: 'decode'
      });
    } catch (sendError) {
      console.error('CircleAI: Failed to send decode response to tab:', sendError);
    }
  } catch (e) {
    console.error('CircleAI: Base64 decode error:', e);
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_RESULT',
        result: `Error: ${e.message}`,
        resultType: 'error'
      });
    } catch (sendError) {
      console.error('CircleAI: Failed to send decode error message to tab:', sendError);
    }
  }
}

// API calling functions
async function callOpenAI(text, settings) {
  const model = settings.model || 'gpt-3.5-turbo';
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{
        role: 'user',
        content: `你是一位專業的資安分析師，請用繁體中文簡潔地解釋這個指令或文本的含義和功能（限制在100字以內）：${text}`
      }],
      max_tokens: settings.maxTokens,
      temperature: settings.temperature
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(text, settings) {
  const model = settings.model || 'gemini-2.5-flash';
  
  // Use OpenAI compatibility endpoint for better compatibility
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{
        role: 'user',
        content: `你是一位專業的資安分析師，請用繁體中文簡潔地解釋這個指令或文本的含義和功能（限制在100字以內）：${text}`
      }],
      max_tokens: settings.maxTokens,
      temperature: settings.temperature
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response from Gemini API');
  }
  return data.choices[0].message.content;
}

async function callAnthropic(text, settings) {
  const model = settings.model || 'claude-3-sonnet-20240229';
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      messages: [{
        role: 'user',
        content: `你是一位專業的資安分析師，請用繁體中文簡潔地解釋這個指令或文本的含義和功能（限制在100字以內）：${text}`
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGrok(text, settings) {
  const model = settings.model || 'grok-beta';
  
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{
        role: 'user',
        content: `你是一位專業的資安分析師，請用繁體中文簡潔地解釋這個指令或文本的含義和功能（限制在100字以內）：${text}`
      }],
      max_tokens: settings.maxTokens,
      temperature: settings.temperature
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Grok API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callCustomAPI(text, settings) {
  if (!settings.customUrl) {
    throw new Error('Custom API URL not configured');
  }

  // Auto-complete URL path based on compatibility mode
  let apiUrl = settings.customUrl;
  
  if (settings.openaiCompatible) {
    // For OpenAI-compatible APIs, ensure the URL ends with /chat/completions
    if (!apiUrl.endsWith('/chat/completions') && !apiUrl.endsWith('/chat/completions/')) {
      // Remove trailing slash if present
      apiUrl = apiUrl.replace(/\/$/, '');
      // Add the chat completions endpoint
      if (!apiUrl.endsWith('/v1')) {
        apiUrl += '/v1';
      }
      apiUrl += '/chat/completions';
    }
  } else {
    // For generic APIs, ensure the URL ends with /completions
    if (!apiUrl.endsWith('/completions') && !apiUrl.endsWith('/completions/')) {
      // Remove trailing slash if present
      apiUrl = apiUrl.replace(/\/$/, '');
      // Add the completions endpoint
      if (!apiUrl.endsWith('/v1')) {
        apiUrl += '/v1';
      }
      apiUrl += '/completions';
    }
  }

  const model = settings.model || 'custom-model';
  let requestBody;
  
  if (settings.openaiCompatible) {
    // OpenAI-compatible format
    requestBody = {
      model: model,
      messages: [{
        role: 'user',
        content: `你是一位專業的資安分析師，請用繁體中文簡潔地解釋這個指令或文本的含義和功能（限制在100字以內）：${text}`
      }],
      max_tokens: settings.maxTokens,
      temperature: settings.temperature
    };
  } else {
    // Generic format
    requestBody = {
      model: model,
      prompt: `你是一位專業的資安分析師，請用繁體中文簡潔地解釋這個指令或文本的含義和功能（限制在100字以內）：${text}`,
      max_tokens: settings.maxTokens,
      temperature: settings.temperature
    };
  }

  try {
    // Enhanced fetch with timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'User-Agent': 'CircleAI-Extension/1.0'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage += ` - ${errorData.error.message}`;
        } else if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        } else if (errorData.detail) {
          errorMessage += ` - ${errorData.detail}`;
        }
      } catch (e) {
        // If we can't parse the error response, use the status text
      }
      
      throw new Error(`Custom API error: ${errorMessage}`);
    }

    const data = await response.json();
    
    // Log the response for debugging
    console.log('Custom API Response:', data);
    
    // Try to extract response in different formats
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    } else if (data.choices && data.choices[0] && data.choices[0].text) {
      return data.choices[0].text;
    } else if (data.response) {
      return data.response;
    } else if (data.text) {
      return data.text;
    } else if (data.content) {
      return data.content;
    } else if (data.message) {
      return data.message;
    } else if (data.result) {
      return data.result;
    } else if (data.output) {
      return data.output;
    } else if (typeof data === 'string') {
      return data;
    } else {
      // For test connection, if we get a 200 response with any JSON, consider it successful
      console.log('Unknown response format, but connection successful:', data);
      return 'Connection test successful - API responded with valid JSON';
    }
    
  } catch (error) {
    // Enhanced error handling with specific error types
    if (error.name === 'AbortError') {
      throw new Error('Connection timeout: Request took longer than 30 seconds. Check your proxy settings and network connection.');
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Network connection failed: Unable to reach the API endpoint. This could be due to:\n1. Incorrect proxy configuration\n2. Network connectivity issues\n3. Firewall blocking the connection\n4. Invalid API URL\n\nPlease check your proxy settings and network connection.');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      throw new Error('DNS resolution failed or connection refused: The API endpoint could not be reached. Please verify:\n1. The API URL is correct\n2. Your proxy settings are properly configured\n3. The target server is accessible from your network');
    } else if (error.message.includes('ETIMEDOUT')) {
      throw new Error('Connection timeout: The request timed out. This might be due to:\n1. Slow proxy response\n2. Network latency issues\n3. Server overload\n\nTry again or check your proxy configuration.');
    } else {
      // Re-throw the original error if it's already a custom error
      throw error;
    }
  }
}

// Function to handle connection testing
async function handleTestConnection(settings, sendResponse) {
  try {
    const testText = 'Hello';
    let response;
    
    switch (settings.apiProvider) {
      case 'openai':
        response = await callOpenAI(testText, settings);
        break;
      case 'gemini':
        response = await callGemini(testText, settings);
        break;
      case 'anthropic':
        response = await callAnthropic(testText, settings);
        break;
      case 'grok':
        response = await callGrok(testText, settings);
        break;
      case 'custom':
        response = await callCustomAPI(testText, settings);
        break;
      default:
        throw new Error('Unknown API provider');
    }
    
    sendResponse({ success: true, error: null });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}