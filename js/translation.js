// ============================================
// FACEBOOK-STYLE TRANSLATION
// ============================================

/**
 * Detect if text contains Hindi characters
 * @param {string} text - Text to check
 * @returns {boolean} - True if Hindi is detected
 */
function containsHindi(text) {
    return /[\u0900-\u097F]/.test(text);
}

/**
 * Translate Hindi text to English using Google Translate API
 * @param {string} text - Text to translate
 * @returns {Promise<string>} - Translated text
 */
async function translateToEnglish(text) {
    // Check cache first
    if (translationCache[text]) {
        console.log('✅ Using cached translation');
        return translationCache[text];
    }
    
    // Check rate limit
    if (translationRequestCount >= MAX_TRANSLATIONS_PER_MINUTE) {
        console.warn('⚠️ Translation rate limit reached');
        return '⏳ Translation limit reached. Please wait...';
    }
    
    // Increment counter and reset after 1 minute
    translationRequestCount++;
    setTimeout(() => translationRequestCount--, 60000);
    
    try {
        const response = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=hi&tl=en&dt=t&q=${encodeURIComponent(text)}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Validate data structure
        if (!data || !data[0]) {
            throw new Error('Invalid translation response');
        }
        
        const translated = data[0].map(item => item[0]).join('');
        translationCache[text] = translated;
        
        console.log('✅ Translation successful');
        return translated;
        
    } catch (error) {
        console.error('❌ Translation error:', error);
        if (window.posthog) {
            posthog.captureException(err, {
                func: 'translateToEnglish',
                postId
            });
        }
        return '⚠️ Translation unavailable. Please try again later.';
    }
}

/**
 * Add translation UI to a post
 * @param {HTMLElement} postElement - The post card element
 * @param {string} originalText - Original text content
 */
function addTranslationFeature(postElement, originalText) {
    if (!originalText || !containsHindi(originalText)) {
        return; // No Hindi text, skip
    }

    const contentDiv = postElement.querySelector('.post-content');
    if (!contentDiv) return;
    
    // Create translation container
    const translationContainer = document.createElement('div');
    translationContainer.className = 'translation-container';
    
    // Create "See translation" link
    const seeTranslationLink = document.createElement('div');
    seeTranslationLink.className = 'translation-link';
    seeTranslationLink.innerHTML = '⚙️ See translation';
    seeTranslationLink.style.display = 'block';
    seeTranslationLink.style.cursor = 'pointer';
    
    // Create translated text div (hidden initially)
    const translatedDiv = document.createElement('div');
    translatedDiv.className = 'translated-text';
    translatedDiv.style.display = 'none';
    
    // Create "Hide original" link
    const hideOriginalLink = document.createElement('div');
    hideOriginalLink.className = 'translation-link';
    hideOriginalLink.innerHTML = '⚙️ Hide original · Rate this translation';
    hideOriginalLink.style.display = 'none';
    hideOriginalLink.style.cursor = 'pointer';
    
    // Click handler for "See translation"
    seeTranslationLink.onclick = async function() {
        seeTranslationLink.innerHTML = '⚙️ Translating...';
        seeTranslationLink.style.cursor = 'wait';
        
        const translation = await translateToEnglish(originalText);
        
        if (translation && !translation.startsWith('⏳') && !translation.startsWith('⚠️')) {
            translatedDiv.innerHTML = Security.sanitizeHTML(translation).replace(/\n/g, '<br>');
            translatedDiv.style.display = 'block';
            seeTranslationLink.style.display = 'none';
            hideOriginalLink.style.display = 'block';
        } else {
            seeTranslationLink.innerHTML = translation || '⚙️ Translation failed';
            seeTranslationLink.style.cursor = 'pointer';
        }
    };
    
    // Click handler for "Hide original"
    hideOriginalLink.onclick = function() {
        const isHidden = contentDiv.style.display === 'none';
        
        if (isHidden) {
            // Show original
            contentDiv.style.display = 'block';
            hideOriginalLink.innerHTML = '⚙️ Hide original · Rate this translation';
        } else {
            // Hide original
            contentDiv.style.display = 'none';
            hideOriginalLink.innerHTML = '⚙️ Show original · Rate this translation';
        }
    };
    
    // Append elements
    translationContainer.appendChild(seeTranslationLink);
    translationContainer.appendChild(translatedDiv);
    translationContainer.appendChild(hideOriginalLink);
    
    // Insert after content
    contentDiv.parentNode.insertBefore(translationContainer, contentDiv.nextSibling);
}

console.log('✅ Translation module loaded');

// Export for other modules
window.Translation = {
    containsHindi,
    translateToEnglish,
    addTranslationFeature
};
