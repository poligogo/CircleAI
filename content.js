// content.js

let lastMouseX = 0;
let lastMouseY = 0;
let extensionContextValid = true;

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
                    console.log('CircleAI Content: Extension context is valid');
                    extensionContextValid = true;
                    return true;
                }
            } catch (urlError) {
                console.error('CircleAI Content: Extension URL check failed:', urlError);
            }
        }
        
        console.error('CircleAI Content: Extension context is invalid');
        extensionContextValid = false;
        return false;
    } catch (error) {
        console.error('CircleAI Content: Error checking extension context:', error);
        extensionContextValid = false;
        return false;
    }
}

// Safe message sending function with retry mechanism
function safeSendMessage(message, callback, retryCount = 0) {
    const maxRetries = 3;
    
    if (!checkExtensionContext()) {
        if (retryCount < maxRetries) {
            console.log(`CircleAI: Extension context invalid, retrying... (${retryCount + 1}/${maxRetries})`);
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
                console.error('CircleAI: Runtime error:', chrome.runtime.lastError);
                
                // If it's a context invalidated error, try to reconnect
                if (chrome.runtime.lastError.message && 
                    (chrome.runtime.lastError.message.includes('Extension context invalidated') ||
                     chrome.runtime.lastError.message.includes('receiving end does not exist'))) {
                    
                    if (retryCount < maxRetries) {
                        console.log(`CircleAI: Context invalidated, retrying... (${retryCount + 1}/${maxRetries})`);
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
        console.error('CircleAI: Error sending message:', error);
        
        if (retryCount < maxRetries) {
            console.log(`CircleAI: Send error, retrying... (${retryCount + 1}/${maxRetries})`);
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
        console.log('CircleAI: Ask AI button clicked, sending message:', selectedText);
        
        // Remove bubble first, then show loading
        const bubble = document.getElementById('circleai-selection-bubble');
        if (bubble) bubble.remove();
        
        // Show loading state immediately
        showLoadingResult('🤖 Briefing...');
        
        safeSendMessage({ type: 'ASK_AI', text: selectedText }, (response, error) => {
            if (error) {
                console.error('CircleAI: Error:', error);
                showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用\n\n錯誤詳情：' + (error.message || error.toString()));
            }
            // Response will be handled by message listener
        });
    };

    const decodeButton = document.createElement('button');
    decodeButton.textContent = 'Decode';
    decodeButton.onclick = (e) => {
        e.stopPropagation();
        console.log('CircleAI: Decode button clicked, selected text:', selectedText);
        console.log('CircleAI: Text length:', selectedText.length);
        
        // Check text length before processing
        if (selectedText.length > 5000) {
            console.log('CircleAI: Text too long, showing truncation warning');
            const truncatedText = selectedText.substring(0, 5000);
            showResult(`⚠️ 文本過長 (${selectedText.length} 字符)\n\n為確保穩定性，僅處理前 5000 字符：\n\n${truncatedText}\n\n... (已截斷)`);
            return;
        }
        
        // Remove bubble first, then show loading
        const bubble = document.getElementById('circleai-selection-bubble');
        if (bubble) {
            console.log('CircleAI: Removing selection bubble');
            bubble.remove();
        }
        
        // Show loading state immediately
        console.log('CircleAI: Showing loading state');
        showLoadingResult('🔓 Decoding...');
        
        console.log('CircleAI: Sending DECODE_BASE64 message to background');
        safeSendMessage({ type: 'DECODE_BASE64', text: selectedText }, (response, error) => {
            if (error) {
                console.error('CircleAI: Error sending message:', error);
                showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用\n\n錯誤詳情：' + (error.message || error.toString()));
            } else {
                console.log('CircleAI: Message sent successfully, waiting for response via message listener');
            }
            // Response will be handled by message listener
        });
    };

    const regexButton = document.createElement('button');
    regexButton.textContent = 'To RegEx';
    regexButton.onclick = (e) => {
        e.stopPropagation();
        console.log('CircleAI: To RegEx button clicked, sending message:', selectedText);
        
        // Remove bubble first, then show loading
        const bubble = document.getElementById('circleai-selection-bubble');
        if (bubble) bubble.remove();
        
        // Show loading state immediately
        showLoadingResult('🔄 Converting to RegEx...');
        
        safeSendMessage({ type: 'TO_REGEX', text: selectedText }, (response, error) => {
            if (error) {
                console.error('CircleAI: Error:', error);
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
    console.log('CircleAI: Mouse up event detected');
    
    // Don't show bubble if clicking on existing CircleAI UI
    if (e.target.closest('#circleai-selection-bubble') || e.target.closest('#circleai-container')) {
        console.log('CircleAI: Clicked on existing UI, ignoring');
        return;
    }

    // A brief delay to allow the selection to finalize
    setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        console.log('CircleAI: Selected text:', selectedText);

        if (selectedText) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            console.log('CircleAI: Showing selection bubble');
            showSelectionBubble(rect.left + rect.width / 2, rect.top, selectedText);
        } else {
            removeCircleUI();
        }
    }, 10);
});

// Simplified approach without port connections
// Port connections are unreliable in Manifest V3 when service worker is recycled

// Listen for messages from the background script to show results
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('CircleAI Content: Received message from background:', request);
    if (request.type === 'SHOW_RESULT') {
        console.log('CircleAI Content: Showing result:', request.result);
        showResult(request.result);
    }
});

// Extension initialized - no port connection needed
console.log('CircleAI Content: Extension content script loaded');

// Initial check
checkExtensionContext();

// Setup periodic context check (every 5 seconds)
setInterval(checkExtensionContext, 5000);

// Check extension context when page becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        console.log('CircleAI: Page became visible, checking extension context');
        checkExtensionContext();
    }
});

// Check extension context when window gains focus
window.addEventListener('focus', () => {
    console.log('CircleAI: Window gained focus, checking extension context');
    checkExtensionContext();
});

// Function to display loading state
function showLoadingResult(loadingText) {
    console.log('CircleAI: showLoadingResult called with text:', loadingText);
    // Remove any existing result container only
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
function showResult(content) {
    console.log('CircleAI: showResult called with content:', content);
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
    
    console.log('CircleAI: Created container element with forced styles');

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
        console.log('CircleAI: Close button clicked');
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
    
    // Function to check if text looks like Base64
    const isBase64Like = (text) => {
        const base64Pattern = /^[A-Za-z0-9+\/]{20,}={0,2}$/;
        return base64Pattern.test(text.trim());
    };
    
    // Function to extract Base64 strings from content
    const extractBase64Strings = (text) => {
        const base64Pattern = /[A-Za-z0-9+\/]{20,}={0,2}/g;
        const matches = text.match(base64Pattern) || [];
        return matches.filter(match => isBase64Like(match));
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
                console.log('CircleAI: Decode button clicked for:', base64String.substring(0, 50) + '...');
                // Close current result window
                container.style.opacity = '0';
                container.style.transform = 'scale(0.8) translateY(20px)';
                setTimeout(() => container.remove(), 300);
                
                // Send decode request for this specific Base64 string
                showLoadingResult('🔄 正在解碼 Base64...');
                chrome.runtime.sendMessage({
                    type: 'DECODE_BASE64',
                    text: base64String
                }).catch(error => {
                    console.error('CircleAI: Failed to send decode message:', error);
                    showError('擴展連接已中斷，請重新載入頁面');
                });
            };
            
            buttonContainer.appendChild(decodeButton);
        });
        
        contentWrapper.appendChild(buttonContainer);
    }
    
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
    
    console.log('CircleAI: Positioning container at:', { left, top });
    console.log('CircleAI: Adding container to body');
    document.body.appendChild(container);
    
    // Animate in after a brief delay
    setTimeout(() => {
        container.style.opacity = '1';
        container.style.transform = 'scale(1) translateY(0)';
    }, 50);
    
    // Verify container was added
    const addedContainer = document.getElementById('circleai-container');
    if (addedContainer) {
        console.log('CircleAI: Container successfully added to DOM');
        console.log('CircleAI: Container styles:', window.getComputedStyle(addedContainer));
    } else {
        console.error('CircleAI: Failed to add container to DOM');
    }
}