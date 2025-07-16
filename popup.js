document.addEventListener('DOMContentLoaded', function() {
  const apiProviderSelect = document.getElementById('apiProvider');
  const saveButton = document.getElementById('save');
  const testButton = document.getElementById('test-connection');
  const status = document.getElementById('status');
  const temperatureSlider = document.getElementById('temperature');
  const temperatureValue = document.getElementById('temperature-value');

  const settingsDivs = {
    openai: document.getElementById('openai-settings'),
    gemini: document.getElementById('gemini-settings'),
    anthropic: document.getElementById('anthropic-settings'),
    grok: document.getElementById('grok-settings'),
    custom: document.getElementById('custom-settings')
  };

  const inputs = {
    openai: {
      key: document.getElementById('openai-key'),
      model: document.getElementById('openai-model'),
      customModel: document.getElementById('openai-custom-model-input')
    },
    gemini: {
      key: document.getElementById('gemini-key'),
      model: document.getElementById('gemini-model'),
      customModel: document.getElementById('gemini-custom-model-input')
    },
    anthropic: {
      key: document.getElementById('anthropic-key'),
      model: document.getElementById('anthropic-model'),
      customModel: document.getElementById('anthropic-custom-model-input')
    },
    grok: {
      key: document.getElementById('grok-key'),
      model: document.getElementById('grok-model'),
      customModel: document.getElementById('grok-custom-model-input')
    },
    custom: {
      key: document.getElementById('custom-key'),
      urlSelect: document.getElementById('custom-url-select'),
      url: document.getElementById('custom-url'),
      model: document.getElementById('custom-model'),
      openaiCompatible: document.getElementById('custom-openai-compatible')
    },
    advanced: {
      temperature: document.getElementById('temperature'),
      maxTokens: document.getElementById('max-tokens')
    }
  };

  // Password toggle functionality
  document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      const targetInput = document.getElementById(targetId);
      
      if (targetInput.type === 'password') {
          targetInput.type = 'text';
          this.innerHTML = '👁️';
        } else {
          targetInput.type = 'password';
          this.innerHTML = '👁️‍🗨️';
        }
      });
    });

  // Custom model toggle functionality
  function setupCustomModelToggle(provider) {
    const modelSelect = inputs[provider].model;
    const customModelDiv = document.getElementById(`${provider}-custom-model`);
    
    if (modelSelect && customModelDiv) {
      modelSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
          customModelDiv.style.display = 'block';
        } else {
          customModelDiv.style.display = 'none';
        }
      });
    }
  }

  // Setup custom model toggles for all providers
  ['openai', 'gemini', 'anthropic', 'grok'].forEach(setupCustomModelToggle);

  // Custom URL select functionality
  const customUrlSelect = inputs.custom.urlSelect;
  const customUrlInput = document.getElementById('custom-url-input');
  
  function updateCustomUrlVisibility() {
    if (customUrlSelect && customUrlInput) {
      if (customUrlSelect.value === 'custom') {
        customUrlInput.style.display = 'block';
      } else {
        customUrlInput.style.display = 'none';
        inputs.custom.url.value = customUrlSelect.value;
      }
    }
  }
  
  if (customUrlSelect && customUrlInput) {
    // Set initial state
    updateCustomUrlVisibility();
    
    customUrlSelect.addEventListener('change', function() {
      if (this.value === 'custom') {
        customUrlInput.style.display = 'block';
        inputs.custom.url.value = '';
      } else {
        customUrlInput.style.display = 'none';
        inputs.custom.url.value = this.value;
      }
    });
  }
  
  // URL completion hint functionality
  function updateUrlCompletionHint() {
    const openaiHint = document.getElementById('openai-hint');
    const genericHint = document.getElementById('generic-hint');
    const isOpenaiCompatible = inputs.custom.openaiCompatible.checked;
    
    if (openaiHint && genericHint) {
      if (isOpenaiCompatible) {
        openaiHint.style.display = 'block';
        genericHint.style.display = 'none';
      } else {
        openaiHint.style.display = 'none';
        genericHint.style.display = 'block';
      }
    }
  }
  
  // Add event listener for OpenAI compatibility checkbox
  if (inputs.custom.openaiCompatible) {
    inputs.custom.openaiCompatible.addEventListener('change', updateUrlCompletionHint);
    // Set initial state
    updateUrlCompletionHint();
  }

  // Temperature slider update
  temperatureSlider.addEventListener('input', function() {
    temperatureValue.textContent = this.value;
  });

  // Function to show the correct settings div
  function showSettings(provider) {
    for (const key in settingsDivs) {
      settingsDivs[key].style.display = 'none';
    }
    if (settingsDivs[provider]) {
      settingsDivs[provider].style.display = 'block';
    }
  }

  // Function to show status message
  function showStatus(message, type = 'info') {
    status.textContent = message;
    status.className = type;
    setTimeout(() => {
      status.textContent = '';
      status.className = '';
    }, 3000);
  }

  // Function to validate settings
  function validateSettings(provider, settings) {
    if (!settings.apiKey) {
      throw new Error('API Key is required');
    }

    if (provider === 'custom') {
      if (!settings.customUrl) {
        throw new Error('API URL is required for custom provider');
      }
      if (!settings.model) {
        throw new Error('Model name is required for custom provider');
      }
      // Validate URL format
      try {
        new URL(settings.customUrl);
      } catch {
        throw new Error('Invalid API URL format');
      }
    }

    // Validate temperature
    const temp = parseFloat(settings.temperature);
    if (isNaN(temp) || temp < 0 || temp > 1) {
      throw new Error('Temperature must be between 0 and 1');
    }

    // Validate max tokens
    const maxTokens = parseInt(settings.maxTokens);
    if (isNaN(maxTokens) || maxTokens < 1 || maxTokens > 4096) {
      throw new Error('Max tokens must be between 1 and 4096');
    }
  }

  // Function to get current settings
  function getCurrentSettings() {
    const provider = apiProviderSelect.value;
    const settings = {
      apiProvider: provider,
      temperature: inputs.advanced.temperature.value,
      maxTokens: inputs.advanced.maxTokens.value
    };

    switch(provider) {
      case 'openai':
        settings.apiKey = inputs.openai.key.value;
        settings.model = inputs.openai.model.value === 'custom' ? inputs.openai.customModel.value : inputs.openai.model.value;
        break;
      case 'gemini':
        settings.apiKey = inputs.gemini.key.value;
        settings.model = inputs.gemini.model.value === 'custom' ? inputs.gemini.customModel.value : inputs.gemini.model.value;
        break;
      case 'anthropic':
        settings.apiKey = inputs.anthropic.key.value;
        settings.model = inputs.anthropic.model.value === 'custom' ? inputs.anthropic.customModel.value : inputs.anthropic.model.value;
        break;
      case 'grok':
        settings.apiKey = inputs.grok.key.value;
        settings.model = inputs.grok.model.value === 'custom' ? inputs.grok.customModel.value : inputs.grok.model.value;
        break;
      case 'custom':
        settings.apiKey = inputs.custom.key.value;
        // Get URL from select or custom input
        const urlSelectValue = inputs.custom.urlSelect.value;
        settings.customUrl = urlSelectValue === 'custom' ? inputs.custom.url.value : urlSelectValue;
        settings.model = inputs.custom.model.value;
        settings.openaiCompatible = inputs.custom.openaiCompatible.checked;
        break;
    }

    return settings;
  }

  // Event listener for provider selection change
  apiProviderSelect.addEventListener('change', () => {
    showSettings(apiProviderSelect.value);
  });

  // Test connection functionality
  testButton.addEventListener('click', async function() {
    try {
      const settings = getCurrentSettings();
      validateSettings(settings.apiProvider, settings);
      
      testButton.disabled = true;
      testButton.textContent = 'Testing...';
      
      // Send test message to background script
      chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        settings: settings
      }, (response) => {
        testButton.disabled = false;
        testButton.textContent = 'Test Connection';
        
        if (response && response.success) {
          showStatus('✅ Connection successful!', 'success');
        } else {
          showStatus(`❌ Connection failed: ${response?.error || 'Unknown error'}`, 'error');
        }
      });
    } catch (error) {
      testButton.disabled = false;
      testButton.textContent = 'Test Connection';
      showStatus(`❌ ${error.message}`, 'error');
    }
  });

  // Load saved settings
  chrome.storage.sync.get([
    'apiProvider', 'apiKey', 'model', 'customUrl', 'openaiCompatible',
    'temperature', 'maxTokens'
  ], function(items) {
    // Set provider
    if (items.apiProvider) {
      apiProviderSelect.value = items.apiProvider;
      showSettings(items.apiProvider);
      
      // Set provider-specific settings
      switch(items.apiProvider) {
        case 'openai':
          if (items.apiKey) inputs.openai.key.value = items.apiKey;
          if (items.model) {
            // Check if it's a predefined model or custom
            const predefinedModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
            if (predefinedModels.includes(items.model)) {
              inputs.openai.model.value = items.model;
            } else {
              inputs.openai.model.value = 'custom';
              inputs.openai.customModel.value = items.model;
              document.getElementById('openai-custom-model').style.display = 'block';
            }
          }
          break;
        case 'gemini':
          if (items.apiKey) inputs.gemini.key.value = items.apiKey;
          if (items.model) {
            const predefinedModels = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite-preview-06-17', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
            if (predefinedModels.includes(items.model)) {
              inputs.gemini.model.value = items.model;
            } else {
              inputs.gemini.model.value = 'custom';
              inputs.gemini.customModel.value = items.model;
              document.getElementById('gemini-custom-model').style.display = 'block';
            }
          }
          break;
        case 'anthropic':
          if (items.apiKey) inputs.anthropic.key.value = items.apiKey;
          if (items.model) {
            const predefinedModels = ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229'];
            if (predefinedModels.includes(items.model)) {
              inputs.anthropic.model.value = items.model;
            } else {
              inputs.anthropic.model.value = 'custom';
              inputs.anthropic.customModel.value = items.model;
              document.getElementById('anthropic-custom-model').style.display = 'block';
            }
          }
          break;
        case 'grok':
          if (items.apiKey) inputs.grok.key.value = items.apiKey;
          if (items.model) {
            const predefinedModels = ['grok-beta', 'grok-vision-beta', 'grok-2-1212', 'grok-2-vision-1212'];
            if (predefinedModels.includes(items.model)) {
              inputs.grok.model.value = items.model;
            } else {
              inputs.grok.model.value = 'custom';
              inputs.grok.customModel.value = items.model;
              document.getElementById('grok-custom-model').style.display = 'block';
            }
          }
          break;
        case 'custom':
          if (items.apiKey) inputs.custom.key.value = items.apiKey;
          if (items.customUrl) {
            // Check if the URL matches any predefined options
            const predefinedUrls = [
              'http://localhost:11434/v1',
              'https://api.openai.com/v1',
              'http://localhost:1234/v1',
              'http://localhost:8080/v1'
            ];
            
            if (predefinedUrls.includes(items.customUrl)) {
              inputs.custom.urlSelect.value = items.customUrl;
              document.getElementById('custom-url-input').style.display = 'none';
            } else {
              inputs.custom.urlSelect.value = 'custom';
              inputs.custom.url.value = items.customUrl;
              document.getElementById('custom-url-input').style.display = 'block';
            }
          } else {
            // If no saved URL, ensure proper initial state
            updateCustomUrlVisibility();
          }
          if (items.model) inputs.custom.model.value = items.model;
          if (items.openaiCompatible !== undefined) {
            inputs.custom.openaiCompatible.checked = items.openaiCompatible;
          }
          // Update URL completion hint after loading settings
          updateUrlCompletionHint();
          break;
      }
    } else {
      showSettings('openai'); // Default to openai
    }

    // Set advanced settings
    if (items.temperature !== undefined) {
      inputs.advanced.temperature.value = items.temperature;
      temperatureValue.textContent = items.temperature;
    }
    if (items.maxTokens !== undefined) {
      inputs.advanced.maxTokens.value = items.maxTokens;
    }
  });

  // Save settings
  saveButton.addEventListener('click', function() {
    try {
      const settings = getCurrentSettings();
      validateSettings(settings.apiProvider, settings);
      
      chrome.storage.sync.set(settings, function() {
        if (chrome.runtime.lastError) {
          showStatus(`❌ Save failed: ${chrome.runtime.lastError.message}`, 'error');
        } else {
          showStatus('✅ Settings saved successfully!', 'success');
        }
      });
    } catch (error) {
      showStatus(`❌ ${error.message}`, 'error');
    }
  });
});