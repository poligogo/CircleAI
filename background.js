// background.js

// Service worker lifecycle management
chrome.runtime.onStartup.addListener(() => {
  console.log('CircleAI Background: Service worker started');
  // Reinitialize keep-alive mechanisms on startup
  keepServiceWorkerAlive();
  // Set up initial state
  chrome.storage.local.set({ extensionActive: true, lastStartup: Date.now() });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('CircleAI Background: Extension installed/updated');
  // Set up initial state on installation/update
  chrome.storage.local.set({ 
    extensionActive: true, 
    lastInit: Date.now(),
    installReason: chrome.runtime.getManifest().version 
  });
});

// Enhanced Service worker keep-alive mechanism
// Use multiple strategies to prevent service worker from being terminated
let keepAliveInterval;
let storageHeartbeatInterval;

function keepServiceWorkerAlive() {
  // Strategy 1: More frequent heartbeat using chrome.runtime.getPlatformInfo
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      if (chrome.runtime.lastError) {
        console.log('CircleAI Background: Keep alive ping failed');
      } else {
        console.log('CircleAI Background: Keep alive ping successful');
      }
    });
  }, 10000); // Ping every 10 seconds (more frequent)
  
  // Strategy 2: Keep service worker active with storage operations
  storageHeartbeatInterval = setInterval(() => {
    chrome.storage.local.set({ lastHeartbeat: Date.now() }, () => {
      if (chrome.runtime.lastError) {
        console.log('CircleAI Background: Storage heartbeat failed');
      } else {
        console.log('CircleAI Background: Storage heartbeat completed');
      }
    });
  }, 10000); // Every 10 seconds (more frequent)
}

// Start keep alive mechanism
keepServiceWorkerAlive();

// Strategy 3: Enhanced alarm events with additional activity
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'circleai-keepalive') {
    console.log('CircleAI Background: Alarm keep alive triggered');
    // Additional activity to keep service worker alive
    chrome.runtime.getPlatformInfo(() => {
      console.log('CircleAI Background: Alarm heartbeat completed');
    });
    // Update storage to maintain activity
    chrome.storage.local.set({ lastAlarmTrigger: Date.now() });
  }
});

// Create a more frequent recurring alarm
chrome.alarms.create('circleai-keepalive', { periodInMinutes: 0.25 }); // Every 15 seconds

// Additional keep-alive strategies
setInterval(() => {
  // Perform lightweight operations to keep service worker active
  chrome.runtime.getPlatformInfo(() => {
    console.log('CircleAI Background: Additional heartbeat completed');
  });
  // Update storage with timestamp
  chrome.storage.local.set({ keepAliveTimestamp: Date.now() });
}, 8000); // Every 8 seconds

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('CircleAI Background: Received message:', request);
    
    // Handle PING messages for connection health check
    if (request.type === 'PING') {
        console.log('CircleAI Background: Handling PING request');
        sendResponse({ status: 'alive', timestamp: Date.now() });
        return true;
    }
    
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
        console.log('CircleAI Background: Request details:', { text: request.text, tabId: tabId });
        handleBase64Decode(request.text, tabId);
    } else if (request.type === 'TO_REGEX') {
        console.log('CircleAI Background: Handling TO_REGEX request');
        handleRegexRequest(request.text, tabId);
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

    // Send message with error handling and retry mechanism
    const sendMessageWithRetry = async (tabId, message, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          await chrome.tabs.sendMessage(tabId, message);
          console.log('CircleAI Background: Message sent successfully');
          return;
        } catch (error) {
          console.error(`CircleAI Background: Send attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };
    
    try {
      await sendMessageWithRetry(tabId, {
        type: 'SHOW_RESULT',
        result: response,
        resultType: 'ai'
      });
    } catch (sendError) {
      console.error('CircleAI: Failed to send AI response to tab after retries:', sendError);
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

// A more robust Base64 decoding function that handles UTF-8 and UTF-16 characters
function b64DecodeUnicode(str) {
    console.log('CircleAI Background: b64DecodeUnicode called with string length:', str.length);
    console.log('CircleAI Background: Input string preview:', str.substring(0, 100));
    
    try {
        const decoded = atob(str);
        console.log('CircleAI Background: atob successful, decoded length:', decoded.length);
        console.log('CircleAI Background: Decoded bytes preview:', decoded.substring(0, 50));
        
        // Check if it contains null bytes (indicator of UTF-16)
        const hasNullBytes = decoded.includes('\0');
        console.log('CircleAI Background: Has null bytes (UTF-16 indicator):', hasNullBytes);
        
        if (hasNullBytes) {
            // This is likely UTF-16 encoded
            console.log('CircleAI Background: Detected UTF-16 encoding');
            
            // Try UTF-16 Little Endian first (most common)
            let resultLE = '';
            for (let i = 0; i < decoded.length; i += 2) {
                const byte1 = decoded.charCodeAt(i) || 0;
                const byte2 = decoded.charCodeAt(i + 1) || 0;
                const charCode = byte1 + (byte2 << 8); // Little Endian
                if (charCode !== 0) {
                    resultLE += String.fromCharCode(charCode);
                }
            }
            
            console.log('CircleAI Background: UTF-16 LE result length:', resultLE.length);
            console.log('CircleAI Background: UTF-16 LE result preview:', resultLE.substring(0, 100));
            
            // Check if Little Endian result looks reasonable
            if (resultLE.length > 0 && /[a-zA-Z0-9\s\-]/.test(resultLE)) {
                console.log('CircleAI Background: UTF-16 LE decode successful');
                return resultLE;
            }
            
            // Try UTF-16 Big Endian
            let resultBE = '';
            for (let i = 0; i < decoded.length; i += 2) {
                const byte1 = decoded.charCodeAt(i) || 0;
                const byte2 = decoded.charCodeAt(i + 1) || 0;
                const charCode = (byte1 << 8) + byte2; // Big Endian
                if (charCode !== 0 && charCode >= 32 && charCode <= 126) {
                    resultBE += String.fromCharCode(charCode);
                }
            }
            
            console.log('CircleAI Background: UTF-16 BE result length:', resultBE.length);
            console.log('CircleAI Background: UTF-16 BE result preview:', resultBE.substring(0, 100));
            
            if (resultBE.length > 0 && /[a-zA-Z0-9\s\-]/.test(resultBE)) {
                console.log('CircleAI Background: UTF-16 BE decode successful');
                return resultBE;
            }
            
            // If both UTF-16 attempts fail, return the Little Endian result anyway
            console.log('CircleAI Background: Both UTF-16 attempts failed, returning LE result');
            return resultLE;
        } else {
            // Try UTF-8 decoding for non-UTF-16 content
            console.log('CircleAI Background: Attempting UTF-8 decode');
            try {
                const utf8Result = decodeURIComponent(decoded.split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                console.log('CircleAI Background: UTF-8 decode successful, result length:', utf8Result.length);
                return utf8Result;
            } catch (utf8Error) {
                console.log('CircleAI Background: UTF-8 decode failed:', utf8Error.message);
                console.log('CircleAI Background: Returning raw decoded string');
                return decoded;
            }
        }
    } catch (e) {
        console.error('CircleAI Background: atob failed:', e.message);
        throw new Error('Invalid Base64 string.');
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
  console.log('CircleAI Background: Starting Base64 decode for text length:', text.length);
  console.log('CircleAI Background: Text preview:', text.substring(0, 50) + '...');
  console.log('CircleAI Background: Target tabId:', tabId);
  
  try {
    // Handle very long text by limiting processing
    const trimmedText = text.trim();
    
    // Enforce length limit to prevent service worker termination (increased for longer Base64 strings)
    //長度限制調整
    const MAX_TEXT_LENGTH = 20000;
    if (trimmedText.length > MAX_TEXT_LENGTH) {
      console.log(`CircleAI Background: Text too long (${trimmedText.length} chars), truncating to ${MAX_TEXT_LENGTH} characters`);
      const truncatedText = trimmedText.substring(0, MAX_TEXT_LENGTH);
      
      try {
        const decodedTruncated = b64DecodeUnicode(truncatedText);
        const resultMessage = `⚠️ 文本過長 (${trimmedText.length} 字符)\n\n為確保穩定性，僅處理前 ${MAX_TEXT_LENGTH} 字符：\n\n解碼結果：\n${decodedTruncated}\n\n... (已截斷)`;
        
        console.log('CircleAI Background: Sending truncated result');
        
        // Use the retry mechanism for sending the message
        const sendMessageWithRetry = async (tabId, message, retries = 3) => {
          for (let i = 0; i < retries; i++) {
            try {
              await chrome.tabs.sendMessage(tabId, message);
              console.log('CircleAI Background: Truncated result sent successfully');
              return true;
            } catch (error) {
              console.error(`CircleAI Background: Send attempt ${i + 1} failed:`, error);
              if (i === retries - 1) {
                throw error;
              }
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          return false;
        };
        
        await sendMessageWithRetry(tabId, {
          type: 'SHOW_RESULT',
          result: resultMessage,
          resultType: 'decode'
        });
      } catch (decodeError) {
        console.error('CircleAI Background: Error decoding truncated text:', decodeError);
        throw new Error(`解碼錯誤：${decodeError.message}`);
      }
      return;
    }
    
    // Clean and validate Base64 format before attempting to decode
    const cleanedText = trimmedText.replace(/\s+/g, ''); // Remove all whitespace
    console.log('CircleAI Background: Cleaned text length:', cleanedText.length);
    console.log('CircleAI Background: Cleaned text preview:', cleanedText.substring(0, 100));
    console.log('CircleAI Background: Cleaned text end:', cleanedText.substring(cleanedText.length - 50));
    
    // More lenient Base64 validation - check if it's mostly Base64 characters
    const base64Chars = cleanedText.match(/[A-Za-z0-9+/=]/g);
    const base64Ratio = base64Chars ? base64Chars.length / cleanedText.length : 0;
    
    console.log('CircleAI Background: Base64 character ratio:', base64Ratio);
    
    if (base64Ratio < 0.8) {
      throw new Error('Text does not appear to be Base64 encoded.');
    }
    
    // Check if the string appears to be truncated (common issue)
    let processText = cleanedText;
    
    // If the string doesn't end properly, try to fix it
    if (!processText.endsWith('=') && processText.length % 4 !== 0) {
      console.log('CircleAI Background: String appears truncated, attempting to fix...');
      
      // Try removing incomplete characters at the end
      const remainder = processText.length % 4;
      if (remainder > 0) {
        processText = processText.substring(0, processText.length - remainder);
        console.log('CircleAI Background: Removed', remainder, 'characters from end');
      }
    }
    
    // Try to pad the string if needed
    let paddedText = processText;
    while (paddedText.length % 4 !== 0) {
      paddedText += '=';
    }
    
    console.log('CircleAI Background: Final text length:', paddedText.length);
    console.log('CircleAI Background: Using padded text for decoding:', paddedText.substring(0, 100));
    
    const decoded = b64DecodeUnicode(paddedText);
    console.log('CircleAI Background: Initial decode result length:', decoded.length);
    console.log('CircleAI Background: Initial decode preview:', decoded.substring(0, 100) + '...');
    
    // Check if the result is still Base64 encoded (recursive decoding)
    let finalResult = decoded;
    let decodingSteps = [cleanedText];
    let currentText = decoded;
    let maxIterations = 5; // Prevent infinite loops
    
    while (maxIterations > 0 && isBase64(currentText) && currentText.length < 20000) {
      try {
        const nextDecoded = b64DecodeUnicode(currentText);
        if (nextDecoded === currentText) break; // No change, stop
        decodingSteps.push(currentText);
        currentText = nextDecoded;
        finalResult = nextDecoded;
        maxIterations--;
      } catch (e) {
        console.log('CircleAI Background: Recursive decoding failed:', e.message);
        break; // Stop if decoding fails
      }
    }
    
    decodingSteps.push(finalResult);
    
    // Highlight potential Base64 strings in the result
    const highlightBase64 = (text) => {
      // Look for Base64-like patterns (at least 20 characters, mostly Base64 chars)
      const base64Pattern = /[A-Za-z0-9+\/]{20,}={0,2}/g;
      return text.replace(base64Pattern, (match) => {
        if (isBase64(match)) {
          return `🔍 [可解碼] ${match} [可解碼] 🔍`;
        }
        return match;
      });
    };
    
    const highlightedResult = highlightBase64(finalResult);
    
    let resultMessage = `🔓 Base64 解碼結果:\n\n${highlightedResult}`;
    if (decodingSteps.length > 2) {
      resultMessage += `\n\n📋 解碼步驟:\n${decodingSteps.map((step, index) => `${index + 1}. ${step.length > 100 ? step.substring(0, 100) + '...' : step}`).join('\n')}`;
    }
    
    // Add instruction for further decoding
    if (highlightedResult.includes('🔍 [可解碼]')) {
      resultMessage += `\n\n💡 提示: 發現可能的 Base64 字符串（標記為 🔍 [可解碼] ... [可解碼] 🔍），您可以選擇這些字符串進行進一步解碼。`;
    }
    
    console.log('CircleAI Background: Final result message length:', resultMessage.length);
    console.log('CircleAI Background: Final result preview:', resultMessage.substring(0, 200) + '...');
    
    // Check message size and truncate if necessary
    const maxMessageSize = 50000; // Chrome extension message size limit
    if (resultMessage.length > maxMessageSize) {
      console.log('CircleAI Background: Result too long, truncating for display');
      resultMessage = resultMessage.substring(0, maxMessageSize - 100) + '\n\n... (Result truncated due to size limit)';
    }
    
    // Send message with error handling and retry mechanism
    console.log('CircleAI Background: Attempting to send SHOW_RESULT message to tab:', tabId);
    
    const sendMessageWithRetry = async (tabId, message, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          await chrome.tabs.sendMessage(tabId, message);
          console.log('CircleAI Background: Successfully sent decode result to tab');
          return;
        } catch (error) {
          console.error(`CircleAI Background: Send attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };
    
    try {
      await sendMessageWithRetry(tabId, {
        type: 'SHOW_RESULT',
        result: resultMessage,
        resultType: 'decode'
      });
    } catch (sendError) {
      console.error('CircleAI: Failed to send decode response to tab after retries:', sendError);
      console.error('CircleAI: Tab ID:', tabId, 'Error details:', sendError);
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

// Function to handle RegEx conversion requests
async function handleRegexRequest(text, tabId) {
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
        response = await callOpenAIForRegex(text, settings);
        break;
      case 'gemini':
        response = await callGeminiForRegex(text, settings);
        break;
      case 'anthropic':
        response = await callAnthropicForRegex(text, settings);
        break;
      case 'grok':
        response = await callGrokForRegex(text, settings);
        break;
      case 'custom':
        response = await callCustomAPIForRegex(text, settings);
        break;
      default:
        throw new Error('Unknown API provider');
    }

    // Send message with error handling and retry mechanism
    const sendMessageWithRetry = async (tabId, message, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          await chrome.tabs.sendMessage(tabId, message);
          console.log('CircleAI Background: RegEx message sent successfully');
          return;
        } catch (error) {
          console.error(`CircleAI Background: RegEx send attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };
    
    try {
      await sendMessageWithRetry(tabId, {
        type: 'SHOW_RESULT',
        result: response,
        resultType: 'regex'
      });
    } catch (sendError) {
      console.error('CircleAI: Failed to send RegEx response to tab after retries:', sendError);
    }
  } catch (error) {
    console.error('CircleAI: RegEx request error:', error);
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_RESULT',
        result: `Error: ${error.message}`,
        resultType: 'error'
      });
    } catch (sendError) {
      console.error('CircleAI: Failed to send RegEx error message to tab:', sendError);
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

// RegEx-specific API calling functions
async function callOpenAIForRegex(text, settings) {
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
        content: `請分析以下文本並生成對應的正則表達式。文本可能包含命令行、文件路徑、URL、電子郵件地址或其他模式。請提供：
1. 匹配該模式的正則表達式
2. 簡短的解釋說明
3. 如果可能，提供一個測試示例

文本：${text}`
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

async function callGeminiForRegex(text, settings) {
  const model = settings.model || 'gemini-2.5-flash';
  
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
        content: `請分析以下文本並生成對應的正則表達式。文本可能包含命令行、文件路徑、URL、電子郵件地址或其他模式。請提供：
1. 匹配該模式的正則表達式
2. 簡短的解釋說明
3. 如果可能，提供一個測試示例

文本：${text}`
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

async function callAnthropicForRegex(text, settings) {
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
        content: `請分析以下文本並生成對應的正則表達式。文本可能包含命令行、文件路徑、URL、電子郵件地址或其他模式。請提供：
1. 匹配該模式的正則表達式
2. 簡短的解釋說明
3. 如果可能，提供一個測試示例

文本：${text}`
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

async function callGrokForRegex(text, settings) {
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
        content: `請分析以下文本並生成對應的正則表達式。文本可能包含命令行、文件路徑、URL、電子郵件地址或其他模式。請提供：
1. 匹配該模式的正則表達式
2. 簡短的解釋說明
3. 如果可能，提供一個測試示例

文本：${text}`
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

async function callCustomAPIForRegex(text, settings) {
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
  
  const regexPrompt = `請分析以下文本並生成對應的正則表達式。文本可能包含命令行、文件路徑、URL、電子郵件地址或其他模式。請提供：
1. 匹配該模式的正則表達式
2. 簡短的解釋說明
3. 如果可能，提供一個測試示例

文本：${text}`;
  
  if (settings.openaiCompatible) {
    // OpenAI-compatible format
    requestBody = {
      model: model,
      messages: [{
        role: 'user',
        content: regexPrompt
      }],
      max_tokens: settings.maxTokens,
      temperature: settings.temperature
    };
  } else {
    // Generic format
    requestBody = {
      model: model,
      prompt: regexPrompt,
      max_tokens: settings.maxTokens,
      temperature: settings.temperature
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
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
      throw new Error('Unknown response format from Custom API');
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Connection timeout: Request took longer than 30 seconds.');
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Network connection failed: Unable to reach the API endpoint.');
    } else {
      throw error;
    }
  }
}