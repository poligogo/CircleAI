// content.js

let lastMouseX = 0;
let lastMouseY = 0;
let extensionContextValid = true;

// Check if extension context is valid and setup auto-reconnect mechanism
function checkExtensionContext() {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            console.log('CircleAI Content: Extension context is valid');
            extensionContextValid = true;
            return true;
        } else {
            console.error('CircleAI Content: Extension context is invalid');
            extensionContextValid = false;
            return false;
        }
    } catch (error) {
        console.error('CircleAI Content: Error checking extension context:', error);
        extensionContextValid = false;
        return false;
    }
}

// Safe message sending function with retry mechanism
function safeSendMessage(message, callback) {
    if (!checkExtensionContext()) {
        callback(null, new Error('Extension context is invalid'));
        return;
    }
    
    try {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('CircleAI: Runtime error:', chrome.runtime.lastError);
                callback(null, chrome.runtime.lastError);
            } else {
                callback(response, null);
            }
        });
    } catch (error) {
        console.error('CircleAI: Error sending message:', error);
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
        
        safeSendMessage({ type: 'ASK_AI', text: selectedText }, (response, error) => {
            if (error) {
                console.error('CircleAI: Error:', error);
                showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用\n\n錯誤詳情：' + (error.message || error.toString()));
            } else {
                console.log('CircleAI: Ask AI response:', response);
                showResult(response);
            }
        });
        removeCircleUI();
    };

    const decodeButton = document.createElement('button');
    decodeButton.textContent = 'Decode';
    decodeButton.onclick = (e) => {
        e.stopPropagation();
        console.log('CircleAI: Decode button clicked, sending message:', selectedText);
        
        safeSendMessage({ type: 'DECODE_BASE64', text: selectedText }, (response, error) => {
            if (error) {
                console.error('CircleAI: Error:', error);
                showResult('⚠️ 擴展連接已中斷\n\n請嘗試以下解決方案：\n1. 重新載入此頁面 (F5)\n2. 在 chrome://extensions/ 中重新載入 CircleAI 擴展\n3. 確保擴展已正確安裝並啟用\n\n錯誤詳情：' + (error.message || error.toString()));
            } else {
                console.log('CircleAI: Decode response:', response);
                showResult(response);
            }
        });
        removeCircleUI();
    };

    bubble.appendChild(askButton);
    bubble.appendChild(decodeButton);
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

// Listen for messages from the background script to show results
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('CircleAI Content: Received message from background:', request);
    if (request.type === 'SHOW_RESULT') {
        console.log('CircleAI Content: Showing result:', request.result);
        showResult(request.result);
    }
});

// Add error handling for runtime connection
chrome.runtime.onConnect.addListener((port) => {
    console.log('CircleAI Content: Connected to background script');
});

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

// Function to display the result in a floating div
function showResult(content) {
    console.log('CircleAI: showResult called with content:', content);
    removeCircleUI(); // Remove any existing UI

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