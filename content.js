// content.js

let lastMouseX = 0;
let lastMouseY = 0;
let extensionContextValid = true;
let decodeHistory = []; // Store decode history for navigation
let debugMode = false; // Debug mode toggle - set to true to enable console logs

// Debug logging function
function debugLog(...args) {
    if (debugMode) {
        console.log('CircleAI:', ...args);
    }
}

// Debug error logging function
function debugError(...args) {
    if (debugMode) {
        console.error('CircleAI:', ...args);
    }
}

// Check if extension context is valid and setup auto-reconnect mechanism
function checkExtensionContext() {
    try {
        // More comprehensive context check
        if (typeof chrome !== 'undefined' && 
            chrome.runtime && 
            chrome.runtime.id && 
            !chrome.runtime.lastError) {
            
            // Additional check: try to access extension URL
            try {
                const extensionUrl = chrome.runtime.getURL('manifest.json');
                if (extensionUrl) {
                    debugLog('Extension context is valid');
                    extensionContextValid = true;
                    return true;
                }
            } catch (urlError) {
                debugError('Extension URL check failed:', urlError);
            }
        }
        
        debugError('Extension context is invalid');
        extensionContextValid = false;
        // Show user-friendly message about page refresh
        showExtensionReloadNotice();
        return false;
    } catch (error) {
        debugError('Error checking extension context:', error);
        extensionContextValid = false;
        // Show user-friendly message about page refresh
        showExtensionReloadNotice();
        return false;
    }
}

// Show a notice when extension needs to be reconnected
function showExtensionReloadNotice() {
    // Only show once per page load
    if (window.circleAIReloadNoticeShown) return;
    window.circleAIReloadNoticeShown = true;
    
    const notice = document.createElement('div');
    notice.id = 'circleai-reload-notice';
    notice.style.position = 'fixed';
    notice.style.top = '20px';
    notice.style.right = '20px';
    notice.style.zIndex = '2147483647';
    notice.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
    notice.style.color = '#fff';
    notice.style.padding = '15px 20px';
    notice.style.borderRadius = '10px';
    notice.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    notice.style.fontSize = '14px';
    notice.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    notice.style.maxWidth = '300px';
    notice.style.cursor = 'pointer';
    notice.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px;">🔄 CircleAI 需要重新連接</div>
         <div style="font-size: 12px; opacity: 0.9;">請先在 chrome://extensions/ 重新載入擴展</div>
         <div style="font-size: 11px; margin-top: 5px; opacity: 0.7;">然後點擊此通知刷新頁面</div>
    `;
    
    notice.onclick = () => {
        window.location.reload();
    };
    
    document.body.appendChild(notice);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        if (notice.parentNode) {
            notice.style.opacity = '0';
            notice.style.transform = 'translateX(100%)';
            setTimeout(() => notice.remove(), 300);
        }
    }, 10000);
}

// Safe message sending function with retry mechanism
function safeSendMessage(message, callback, retryCount = 0) {
    const maxRetries = 3;
    
    if (!checkExtensionContext()) {
        if (retryCount < maxRetries) {
            debugLog(`Extension context invalid, retrying... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => {
                safeSendMessage(message, callback, retryCount + 1);
            }, 1000);
            return;
        } else {
            callback(null, new Error('Extension context is invalid after retries'));
            return;
        }
    }
    
    try {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                debugError('Runtime error:', chrome.runtime.lastError);
                
                // If it's a context invalidated error, try to reconnect
                if (chrome.runtime.lastError.message && 
                    (chrome.runtime.lastError.message.includes('Extension context invalidated') ||
                     chrome.runtime.lastError.message.includes('receiving end does not exist'))) {
                    
                    if (retryCount < maxRetries) {
                        debugLog(`Context invalidated, retrying... (${retryCount + 1}/${maxRetries})`);
                        setTimeout(() => {
                            safeSendMessage(message, callback, retryCount + 1);
                        }, 1000);
                        return;
                    }
                }
                
                callback(null, chrome.runtime.lastError);
            } else {
                callback(response, null);
            }
        });
    } catch (error) {
        debugError('Error sending message:', error);
        
        if (retryCount < maxRetries) {
            debugLog(`Send error, retrying... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => {
                safeSendMessage(message, callback, retryCount + 1);
            }, 1000);
            return;
        }
        
        callback(null, error);
    }
}

// Function to remove any existing CircleAI UI elements
function removeCircleUI() {
    const bubble = document.getElementById('circleai-selection-bubble');
    if (bubble) bubble.remove();
    const resultContainer = document.getElementById('circleai-container');
    if (resultContainer) resultContainer.remove();
}

// Show selection bubble
function showSelectionBubble(x, y, selectedText) {
    removeCircleUI(); // Remove any existing UI

    const bubble = document.createElement('div');
    bubble.id = 'circleai-selection-bubble';

    const askButton = document.createElement('button');
    askButton.textContent = 'Ask AI';
    askButton.onclick = (e) => {
        e.stopPropagation();
        debugLog('Ask AI button clicked, sending message:', selectedText);
        
        // Remove bubble first, then show loading
        const bubble = document.getElementById('circleai-selection-bubble');
        if (bubble) bubble.remove();
        
        // Show loading state immediately
        showLoadingResult('🤖 Briefing...');
        
        safeSendMessage({ type: 'ASK_AI', text: selectedText }, (response, error) => {
            if (error) {
                debugError('Error:', error);
                showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用\n\n錯誤詳情：' + (error.message || error.toString()));
            }
            // Response will be handled by message listener
        });
    };

    const decodeButton = document.createElement('button');
    decodeButton.textContent = 'Decode';
    decodeButton.onclick = (e) => {
        e.stopPropagation();
        debugLog('Decode button clicked, selected text:', selectedText);
        debugLog('Text length:', selectedText.length);
        
        // Check text length before processing
        // 遞歸解碼的長度限制
        if (selectedText.length > 20000) {
            debugLog('Text too long, showing truncation warning');
            const truncatedText = selectedText.substring(0, 20000);
            showResult(`⚠️ 文本過長 (${selectedText.length} 字符)\n\n為確保穩定性，僅處理前 20000 字符：\n\n${truncatedText}\n\n... (已截斷)`);
            return;
        }
        
        // Remove bubble first, then show loading
        const bubble = document.getElementById('circleai-selection-bubble');
        if (bubble) {
            debugLog('Removing selection bubble');
            bubble.remove();
        }
        
        // Show loading state immediately
        debugLog('Showing loading state');
        showLoadingResult('🔓 Decoding...');
        
        debugLog('Sending DECODE_BASE64 message to background');
        safeSendMessage({ type: 'DECODE_BASE64', text: selectedText }, (response, error) => {
            if (error) {
                debugError('Error sending message:', error);
                showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用\n\n錯誤詳情：' + (error.message || error.toString()));
            } else {
                debugLog('Message sent successfully, waiting for response via message listener');
            }
            // Response will be handled by message listener
        });
    };

    const regexButton = document.createElement('button');
    regexButton.textContent = 'To RegEx';
    regexButton.onclick = (e) => {
        e.stopPropagation();
        debugLog('To RegEx button clicked, sending message:', selectedText);
        
        // Remove bubble first, then show loading
        const bubble = document.getElementById('circleai-selection-bubble');
        if (bubble) bubble.remove();
        
        // Show loading state immediately
        showLoadingResult('🔄 Converting to RegEx...');
        
        safeSendMessage({ type: 'TO_REGEX', text: selectedText }, (response, error) => {
            if (error) {
                debugError('Error:', error);
                showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用\n\n錯誤詳情：' + (error.message || error.toString()));
            }
            // Response will be handled by message listener
        });
    };

    bubble.appendChild(askButton);
    bubble.appendChild(decodeButton);
    bubble.appendChild(regexButton);
    document.body.appendChild(bubble);

    // Position the bubble
    const bubbleRect = bubble.getBoundingClientRect();
    bubble.style.left = `${window.scrollX + x - bubbleRect.width / 2}px`;
    bubble.style.top = `${window.scrollY + y - bubbleRect.height - 10}px`;
}

// Listen for mouse up to check for a selection
document.addEventListener('mouseup', (e) => {
    debugLog('Mouse up event detected');
    
    // Don't show bubble if clicking on existing CircleAI UI
    if (e.target.closest('#circleai-selection-bubble') || e.target.closest('#circleai-container')) {
        debugLog('Clicked on existing UI, ignoring');
        return;
    }

    // A brief delay to allow the selection to finalize
    setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        debugLog('Selected text:', selectedText);

        if (selectedText) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            debugLog('Showing selection bubble');
            showSelectionBubble(rect.left + rect.width / 2, rect.top, selectedText);
        } else {
            removeCircleUI();
        }
    }, 10);
});

// Simplified approach without port connections
// Port connections are unreliable in Manifest V3 when service worker is recycled

// Combined message listener for all background script messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog('Content: Received message from background:', request);
    
    if (request.type === 'SHOW_RESULT') {
        debugLog('Content: Showing result:', request.result);
        showResult(request.result);
    } else if (request.type === 'CONTEXT_MENU_ACTION') {
        debugLog('Content: Context menu action:', request.action);
        
        const selectedText = window.circleAISelectedText;
        if (!selectedText) {
            debugError('No selected text available for context menu action');
            return;
        }
        
        switch (request.action) {
            case 'ask_ai':
                debugLog('Context menu: Ask AI action');
                showLoadingResult('🤖 Briefing...');
                safeSendMessage({ type: 'ASK_AI', text: selectedText }, (response, error) => {
                    if (error) {
                        debugError('Error:', error);
                        showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用\n\n錯誤詳情：' + (error.message || error.toString()));
                    }
                });
                break;
                
            case 'decode_base64':
                debugLog('Context menu: Decode Base64 action');
                if (selectedText.length > 20000) {
                    const truncatedText = selectedText.substring(0, 20000);
                    showResult(`⚠️ 文本過長 (${selectedText.length} 字符)\n\n為確保穩定性，僅處理前 20000 字符：\n\n${truncatedText}\n\n... (已截斷)`);
                    return;
                }
                showLoadingResult('🔓 Decoding...');
                safeSendMessage({ type: 'DECODE_BASE64', text: selectedText }, (response, error) => {
                    if (error) {
                        debugError('Error:', error);
                        showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用\n\n錯誤詳情：' + (error.message || error.toString()));
                    }
                });
                break;
                
            case 'to_regex':
                debugLog('Context menu: To RegEx action');
                showLoadingResult('🔄 Converting to RegEx...');
                safeSendMessage({ type: 'TO_REGEX', text: selectedText }, (response, error) => {
                    if (error) {
                        debugError('Error:', error);
                        showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用\n\n錯誤詳情：' + (error.message || error.toString()));
                    }
                });
                break;
                
            default:
                debugError('Unknown context menu action:', request.action);
        }
    }
});

// Add right-click context menu functionality
document.addEventListener('contextmenu', (e) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText) {
        debugLog('Right-click on selected text:', selectedText);
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        
        // Store selected text for context menu actions
        window.circleAISelectedText = selectedText;
        
        // Send message to background to update context menu
        safeSendMessage({ 
            type: 'UPDATE_CONTEXT_MENU', 
            hasSelection: true,
            text: selectedText.substring(0, 100) // Limit text for menu display
        }, (response, error) => {
            if (error) {
                debugError('Error updating context menu:', error);
            }
        });
    } else {
        // Clear context menu when no selection
        window.circleAISelectedText = null;
        safeSendMessage({ 
            type: 'UPDATE_CONTEXT_MENU', 
            hasSelection: false 
        }, (response, error) => {
            if (error) {
                debugError('Error clearing context menu:', error);
            }
        });
    }
});



// Initialize the extension
function initializeExtension() {
    debugLog('Content: Initializing extension');
    
    // Check extension context immediately
    if (!checkExtensionContext()) {
        debugError('Content: Extension context is invalid during initialization');
        // Show reload notice immediately if context is invalid
        showExtensionReloadNotice();
        return;
    }
    
    // Test initial connection
    chrome.runtime.sendMessage({ type: 'PING' })
        .then(response => {
            if (response && response.status === 'alive') {
                debugLog('Initial connection test passed');
                setupPeriodicChecks();
            } else {
                debugError('Initial connection test failed - no response');
                showExtensionReloadNotice();
            }
        })
        .catch(error => {
            debugError('Initial connection test failed:', error);
            showExtensionReloadNotice();
        });
}

// Setup periodic health checks
function setupPeriodicChecks() {
    // Set up periodic context checking
    setInterval(checkExtensionContext, 3000);
    
    // Set up connection health check
    setInterval(() => {
        if (extensionContextValid) {
            chrome.runtime.sendMessage({ type: 'PING' })
                .then(response => {
                    if (response && response.status === 'alive') {
                        debugLog('Connection health check passed');
                    }
                })
                .catch(error => {
                    debugError('Connection health check failed:', error);
                    extensionContextValid = false;
                });
        }
    }, 5000);
    
    debugLog('Content: Extension initialized successfully');
}

// Extension initialized - no port connection needed
debugLog('Content: Extension content script loaded');

// Initialize the extension
initializeExtension();

// Check extension context when page becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        debugLog('Page became visible, checking extension context');
        checkExtensionContext();
    }
});

// Check extension context when window gains focus
window.addEventListener('focus', () => {
    debugLog('Window gained focus, checking extension context');
    checkExtensionContext();
});

// Function to display loading state
function showLoadingResult(loadingText) {
    debugLog('showLoadingResult called with text:', loadingText);
    // Remove any existing result container only (don't clear history)
    const existingContainer = document.getElementById('circleai-container');
    if (existingContainer) existingContainer.remove();

    const container = document.createElement('div');
    container.id = 'circleai-container';
    
    // Apply same styling as showResult but with loading animation
    container.style.position = 'fixed';
    container.style.zIndex = '2147483647';
    container.style.display = 'block';
    container.style.visibility = 'visible';
    container.style.opacity = '0';
    container.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    container.style.border = 'none';
    container.style.borderRadius = '20px';
    container.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.2), 0 10px 20px rgba(0, 0, 0, 0.1)';
    container.style.padding = '30px';
    container.style.maxWidth = '450px';
    container.style.minHeight = '120px';
    container.style.fontSize = '16px';
    container.style.lineHeight = '1.7';
    container.style.color = '#fff';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.backdropFilter = 'blur(10px)';
    container.style.transform = 'scale(0.8) translateY(20px)';
    container.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    container.style.boxShadow += ', inset 0 1px 0 rgba(255, 255, 255, 0.2)';

    // Create loading content with animation
    const loadingContent = document.createElement('div');
    loadingContent.style.textAlign = 'center';
    loadingContent.style.marginTop = '20px';
    
    const loadingText_elem = document.createElement('div');
    loadingText_elem.textContent = loadingText;
    loadingText_elem.style.fontSize = '18px';
    loadingText_elem.style.marginBottom = '15px';
    
    // Add pulsing dots animation
    const dots = document.createElement('div');
    dots.innerHTML = '●●●';
    dots.style.fontSize = '20px';
    dots.style.letterSpacing = '5px';
    dots.style.animation = 'pulse 1.5s infinite';
    
    // Add CSS animation for dots
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    loadingContent.appendChild(loadingText_elem);
    loadingContent.appendChild(dots);
    container.appendChild(loadingContent);

    // Position container in the center of the viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const containerWidth = 450;
    const containerHeight = 200;
    
    const left = (viewportWidth - containerWidth) / 2;
    const top = (viewportHeight - containerHeight) / 2;
    
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
    
    document.body.appendChild(container);
    
    // Animate in
    setTimeout(() => {
        container.style.opacity = '1';
        container.style.transform = 'scale(1) translateY(0)';
    }, 50);
}

// Function to show error messages
function showError(message) {
    showResult(`⚠️ ${message}`);
}

// Function to display the result in a floating div
function showResult(content, isNewDecode = true) {
    debugLog('showResult called with content:', content);
    
    // Manage decode history
    if (isNewDecode) {
        // Add current content to history (limit to 10 items)
        decodeHistory.push(content);
        if (decodeHistory.length > 10) {
            decodeHistory.shift();
        }
    }
    
    // Remove any existing result container only
    const existingContainer = document.getElementById('circleai-container');
    if (existingContainer) existingContainer.remove();

    const container = document.createElement('div');
    container.id = 'circleai-container';
    
    // Force critical styles to ensure visibility with modern design
    container.style.position = 'fixed';
    container.style.zIndex = '2147483647';
    container.style.display = 'block';
    container.style.visibility = 'visible';
    container.style.opacity = '0';
    container.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    container.style.border = 'none';
    container.style.borderRadius = '20px';
    container.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.2), 0 10px 20px rgba(0, 0, 0, 0.1)';
    container.style.padding = '30px';
    container.style.maxWidth = '450px';
    container.style.minHeight = '120px';
    container.style.maxHeight = '70vh';
    container.style.overflow = 'hidden';
    container.style.fontSize = '16px';
    container.style.lineHeight = '1.7';
    container.style.color = '#fff';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.backdropFilter = 'blur(10px)';
    container.style.transform = 'scale(0.8) translateY(20px)';
    container.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Add subtle inner glow
    container.style.boxShadow += ', inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    
    debugLog('Created container element with forced styles');

    const closeButton = document.createElement('button');
    closeButton.id = 'circleai-close';
    closeButton.innerHTML = '✕';
    
    // Modern close button styles
    closeButton.style.position = 'absolute';
    closeButton.style.top = '15px';
    closeButton.style.right = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '18px';
    closeButton.style.color = 'rgba(255, 255, 255, 0.7)';
    closeButton.style.border = 'none';
    closeButton.style.background = 'rgba(255, 255, 255, 0.1)';
    closeButton.style.borderRadius = '50%';
    closeButton.style.width = '32px';
    closeButton.style.height = '32px';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';
    closeButton.style.fontWeight = 'normal';
    closeButton.style.transition = 'all 0.2s ease';
    closeButton.style.zIndex = '2147483648';
    
    closeButton.onclick = () => {
        debugLog('Close button clicked');
        // Clear decode history when closing
        decodeHistory = [];
        // Animate out before removing
        container.style.opacity = '0';
        container.style.transform = 'scale(0.8) translateY(20px)';
        setTimeout(() => container.remove(), 300);
    };
    
    closeButton.onmouseover = () => {
        closeButton.style.color = '#fff';
        closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
        closeButton.style.transform = 'scale(1.1)';
    };
    
    closeButton.onmouseout = () => {
        closeButton.style.color = 'rgba(255, 255, 255, 0.7)';
        closeButton.style.background = 'rgba(255, 255, 255, 0.1)';
        closeButton.style.transform = 'scale(1)';
    };

    // Create content wrapper with modern styling and scrolling
    const contentWrapper = document.createElement('div');
    contentWrapper.style.marginTop = '10px';
    contentWrapper.style.marginRight = '20px';
    contentWrapper.style.maxHeight = 'calc(70vh - 100px)';
    contentWrapper.style.overflowY = 'auto';
    contentWrapper.style.paddingRight = '10px';
    
    // Custom scrollbar styling
    contentWrapper.style.scrollbarWidth = 'thin';
    contentWrapper.style.scrollbarColor = 'rgba(255, 255, 255, 0.3) transparent';
    
    // Function to check if text is valid Base64
    const isValidBase64 = (text) => {
        const trimmed = text.trim();
        
        // Basic pattern check - must be at least 40 characters for meaningful content
        if (!/^[A-Za-z0-9+\/]{40,}={0,2}$/.test(trimmed)) {
            return false;
        }
        
        // Length must be multiple of 4
        if (trimmed.length % 4 !== 0) {
            return false;
        }
        
        // Check padding rules
        const paddingCount = (trimmed.match(/=/g) || []).length;
        if (paddingCount > 2) {
            return false;
        }
        
        // If there's padding, it should only be at the end
        if (paddingCount > 0 && !trimmed.endsWith('='.repeat(paddingCount))) {
            return false;
        }
        
        // Try to decode to verify it's valid Base64
        try {
            const decoded = atob(trimmed);
            // Check if decoded content has reasonable characteristics
            // - Should be at least 20 bytes
            // - Should not be mostly null bytes or control characters
            if (decoded.length < 20) {
                return false;
            }
            
            // Count printable characters
            let printableCount = 0;
            let nullCount = 0;
            for (let i = 0; i < Math.min(decoded.length, 100); i++) {
                const charCode = decoded.charCodeAt(i);
                if (charCode === 0) {
                    nullCount++;
                } else if ((charCode >= 32 && charCode <= 126) || charCode === 9 || charCode === 10 || charCode === 13) {
                    printableCount++;
                }
            }
            
            // If more than 80% are null bytes, probably not meaningful Base64
            if (nullCount > decoded.length * 0.8) {
                return false;
            }
            
            return true;
        } catch (e) {
            return false;
        }
    };
    
    // Function to extract Base64 strings from content
    const extractBase64Strings = (text) => {
        // Look for longer Base64 patterns (at least 40 characters)
        const base64Pattern = /[A-Za-z0-9+\/]{40,}={0,2}/g;
        const matches = text.match(base64Pattern) || [];
        
        // Filter and validate each match
        const validMatches = [];
        for (const match of matches) {
            if (isValidBase64(match)) {
                // Avoid duplicates
                if (!validMatches.includes(match)) {
                    validMatches.push(match);
                }
            }
        }
        
        // Limit to maximum 5 matches to avoid UI clutter
        return validMatches.slice(0, 5);
    };
    
    const contentP = document.createElement('p');
    contentP.innerText = content;
    contentP.style.whiteSpace = 'pre-wrap';
    contentP.style.margin = '0';
    contentP.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
    contentP.style.wordBreak = 'break-word';
    
    // Add a subtle header if content looks like a response
    const header = document.createElement('div');
    header.style.fontSize = '14px';
    header.style.opacity = '0.8';
    header.style.marginBottom = '15px';
    header.style.fontWeight = '500';
    header.innerHTML = '🤖 CircleAI';
    
    contentWrapper.appendChild(header);
    contentWrapper.appendChild(contentP);
    
    // Add back button if there's decode history
    if (decodeHistory.length > 1) {
        const backButtonContainer = document.createElement('div');
        backButtonContainer.style.marginTop = '15px';
        backButtonContainer.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
        backButtonContainer.style.paddingTop = '15px';
        
        const backButton = document.createElement('button');
        backButton.textContent = '← 返回上一層';
        backButton.style.display = 'block';
        backButton.style.width = '100%';
        backButton.style.padding = '10px 15px';
        backButton.style.background = 'rgba(255, 255, 255, 0.15)';
        backButton.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        backButton.style.borderRadius = '8px';
        backButton.style.color = '#fff';
        backButton.style.cursor = 'pointer';
        backButton.style.fontSize = '14px';
        backButton.style.fontWeight = '500';
        backButton.style.transition = 'all 0.2s ease';
        
        backButton.onmouseover = () => {
            backButton.style.background = 'rgba(255, 255, 255, 0.25)';
            backButton.style.transform = 'translateY(-1px)';
        };
        
        backButton.onmouseout = () => {
            backButton.style.background = 'rgba(255, 255, 255, 0.15)';
            backButton.style.transform = 'translateY(0)';
        };
        
        backButton.onclick = () => {
            debugLog('Back button clicked');
            // Remove current item from history
            decodeHistory.pop();
            // Get previous content
            const previousContent = decodeHistory[decodeHistory.length - 1];
            if (previousContent) {
                // Show previous content without adding to history
                showResult(previousContent, false);
            }
        };
        
        backButtonContainer.appendChild(backButton);
        contentWrapper.appendChild(backButtonContainer);
    }
    
    // Check for Base64 strings and add decode buttons
    const base64Strings = extractBase64Strings(content);
    if (base64Strings.length > 0) {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
        buttonContainer.style.paddingTop = '15px';
        
        const buttonTitle = document.createElement('div');
        buttonTitle.textContent = '🔍 發現可解碼的 Base64 字符串:';
        buttonTitle.style.fontSize = '14px';
        buttonTitle.style.marginBottom = '10px';
        buttonTitle.style.opacity = '0.9';
        buttonContainer.appendChild(buttonTitle);
        
        base64Strings.forEach((base64String, index) => {
            const decodeButton = document.createElement('button');
            decodeButton.textContent = `解碼第 ${index + 1} 段 (${base64String.length} 字符)`;
            decodeButton.style.display = 'block';
            decodeButton.style.width = '100%';
            decodeButton.style.margin = '5px 0';
            decodeButton.style.padding = '10px 15px';
            decodeButton.style.background = 'rgba(255, 255, 255, 0.2)';
            decodeButton.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            decodeButton.style.borderRadius = '8px';
            decodeButton.style.color = '#fff';
            decodeButton.style.cursor = 'pointer';
            decodeButton.style.fontSize = '14px';
            decodeButton.style.transition = 'all 0.2s ease';
            
            decodeButton.onmouseover = () => {
                decodeButton.style.background = 'rgba(255, 255, 255, 0.3)';
                decodeButton.style.transform = 'translateY(-1px)';
            };
            
            decodeButton.onmouseout = () => {
                decodeButton.style.background = 'rgba(255, 255, 255, 0.2)';
                decodeButton.style.transform = 'translateY(0)';
            };
            
            decodeButton.onclick = () => {
                debugLog('Decode button clicked for:', base64String.substring(0, 50) + '...');
                
                // Show loading state in current window
                showLoadingResult('🔄 正在解碼 Base64...');
                
                // Send decode request with enhanced retry mechanism
                const sendDecodeMessage = async (retries = 3) => {
                    for (let i = 0; i < retries; i++) {
                        try {
                            await chrome.runtime.sendMessage({
                                type: 'DECODE_BASE64',
                                text: base64String
                            });
                            debugLog('Decode message sent successfully');
                            return;
                        } catch (error) {
                            debugError(`Decode message attempt ${i + 1} failed:`, error);
                     if (i === retries - 1) {
                         // Check if it's an extension context issue
                         if (error.message && error.message.includes('Extension context')) {
                             showExtensionReloadNotice();
                             return;
                         }
                         showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用');
                     } else {
                         // Wait before retry
                         await new Promise(resolve => setTimeout(resolve, 1000));
                     }
                        }
                    }
                };
                sendDecodeMessage();
            };
            
            buttonContainer.appendChild(decodeButton);
        });
        
        contentWrapper.appendChild(buttonContainer);
     }
     
     // Add AI analysis button for any content
     const aiButtonContainer = document.createElement('div');
     aiButtonContainer.style.marginTop = '15px';
     aiButtonContainer.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
     aiButtonContainer.style.paddingTop = '15px';
     
     const aiButton = document.createElement('button');
     aiButton.textContent = '🤖 詢問 AI 分析此內容';
     aiButton.style.display = 'block';
     aiButton.style.width = '100%';
     aiButton.style.padding = '12px 15px';
     aiButton.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
     aiButton.style.border = 'none';
     aiButton.style.borderRadius = '8px';
     aiButton.style.color = '#fff';
     aiButton.style.cursor = 'pointer';
     aiButton.style.fontSize = '14px';
     aiButton.style.fontWeight = '500';
     aiButton.style.transition = 'all 0.2s ease';
     aiButton.style.boxShadow = '0 2px 8px rgba(79, 172, 254, 0.3)';
     
     aiButton.onmouseover = () => {
         aiButton.style.transform = 'translateY(-2px)';
         aiButton.style.boxShadow = '0 4px 12px rgba(79, 172, 254, 0.4)';
     };
     
     aiButton.onmouseout = () => {
         aiButton.style.transform = 'translateY(0)';
         aiButton.style.boxShadow = '0 2px 8px rgba(79, 172, 254, 0.3)';
     };
     
     aiButton.onclick = () => {
         debugLog('AI analysis button clicked for content');
         
         // Show loading state in current window
         showLoadingResult('🤖 AI 正在分析內容...');
         
         // Send AI analysis request with enhanced retry mechanism
         const sendAIMessage = async (retries = 3) => {
             for (let i = 0; i < retries; i++) {
                 try {
                     await chrome.runtime.sendMessage({
                         type: 'ASK_AI',
                         text: content
                     });
                     debugLog('AI analysis message sent successfully');
                     return;
                 } catch (error) {
                     debugError(`AI analysis message attempt ${i + 1} failed:`, error);
                     if (i === retries - 1) {
                         // Check if it's an extension context issue
                         if (error.message && error.message.includes('Extension context')) {
                             showExtensionReloadNotice();
                             return;
                         }
                         showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用');
                     } else {
                         // Wait before retry
                         await new Promise(resolve => setTimeout(resolve, 1000));
                     }
                 }
             }
         };
         sendAIMessage();
     };
     
     aiButtonContainer.appendChild(aiButton);
     contentWrapper.appendChild(aiButtonContainer);
     
     container.appendChild(closeButton);
     container.appendChild(contentWrapper);

    // Position container in the center of the viewport for maximum visibility
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const containerWidth = 450;
    const containerHeight = 200;
    
    // Center the container in the viewport
    const left = (viewportWidth - containerWidth) / 2;
    const top = (viewportHeight - containerHeight) / 2;
    
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
    
    debugLog('Positioning container at:', { left, top });
    debugLog('Adding container to body');
    document.body.appendChild(container);
    
    // Animate in after a brief delay
    setTimeout(() => {
        container.style.opacity = '1';
        container.style.transform = 'scale(1) translateY(0)';
    }, 50);
    
    // Verify container was added
    const addedContainer = document.getElementById('circleai-container');
    if (addedContainer) {
        debugLog('Container successfully added to DOM');
        debugLog('Container styles:', window.getComputedStyle(addedContainer));
    } else {
        debugError('Failed to add container to DOM');
    }
}