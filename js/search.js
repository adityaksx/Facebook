// ============================================
// SEARCH & FILTER WITH FUSE.JS
// ============================================

let fuseInstance = null;

/**
 * Parse and normalize dates for better searching
 * @param {string} dateString - Date string to normalize
 * @returns {string} - Space-separated date formats for fuzzy matching
 */
function normalizeDateForSearch(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    // Create multiple date format strings for matching
    const formats = [
        date.toLocaleDateString('en-US'),
        date.toLocaleDateString('en-GB'),
        date.toDateString(),
        `${date.getDate()} ${date.toLocaleString('en', { month: 'long' })}`,
        `${date.toLocaleString('en', { month: 'long' })} ${date.getDate()}`,
        `${date.getDate()} ${date.toLocaleString('en', { month: 'short' })}`,
        `${date.toLocaleString('en', { month: 'short' })} ${date.getDate()}`,
        date.getFullYear().toString(),
        date.toLocaleString('en', { month: 'long' })
    ];
    
    return formats.join(' ');
}

/**
 * Clean URLs and extra whitespace from content
 * @param {string} content - Content to clean
 * @returns {string} - Cleaned content
 */
function cleanContentForSearch(content) {
    if (!content) return '';
    
    // Remove URLs
    let cleaned = content.replace(/https?:\/\/[^\s]+/g, '');
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

/**
 * Initialize Fuse.js search with flexible configuration
 */
function initializeSearch() {
    if (!allPosts || allPosts.length === 0) {
        console.warn('⚠️ No posts available for search initialization');
        return;
    }

    // Prepare posts with searchable text
    const searchablePosts = allPosts.map(post => ({
        ...post,
        searchableDate: normalizeDateForSearch(post.timestamp || post.date),
        searchableContent: cleanContentForSearch(
            (post.content || '') + ' ' + 
            (post.location || '') + ' ' + 
            (post.caption || '')
        )
    }));

    // Very flexible Fuse.js configuration
    const fuseOptions = {
        keys: [
            { name: 'searchableContent', weight: 0.7 },  // Higher weight for content
            { name: 'searchableDate', weight: 0.2 },
            { name: 'location', weight: 0.1 }
        ],
        threshold: 0.3,           // Balanced - not too strict, not too fuzzy
        distance: 100,
        minMatchCharLength: 2,
        ignoreLocation: true,
        includeScore: true,
        shouldSort: true,
        useExtendedSearch: true,
    };

    fuseInstance = new Fuse(searchablePosts, fuseOptions);
    console.log(`✅ Search initialized with ${allPosts.length} posts`);
}

/**
 * Translate user query using Google Translate API
 * @param {string} query - Query to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} - Translated query
 */
async function translateQuery(query, targetLang) {
    try {
        const response = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        return data[0][0][0];
    } catch (error) {
        console.error('❌ Translation error:', error);
        return query; // Return original query on error
    }
}

/**
 * Main dual-language search handler
 * Searches in user's language + Hindi + English
 * @param {string} searchTerm - Search query
 */
async function handleSearch(searchTerm) {
    if (!fuseInstance) {
        console.error('❌ Search not initialized');
        return;
    }

    if (!searchTerm || searchTerm.trim() === '') {
        filteredPosts = [...allPosts];
        currentPage = 0;
        document.getElementById('postsContainer').innerHTML = '';
        PostRenderer.renderPosts();
        updateSearchResults(allPosts.length, '');
        return;
    }

    let term = searchTerm.trim();
    const resultMap = new Map();

    // 1. Search the user's input (Hindi/English/numbers/anything)
    let results = fuseInstance.search(term);
    results.forEach(r => resultMap.set(r.item.timestamp + (r.item.content || ''), r.item));

    // 2. Search Hindi translation (as normal text)
    try {
        const hindiQuery = await translateQuery(term, 'hi');
        if (hindiQuery && hindiQuery !== term) {
            let hRes = fuseInstance.search(hindiQuery);
            hRes.forEach(r => resultMap.set(r.item.timestamp + (r.item.content || ''), r.item));
        }
    } catch (err) {
        console.warn('⚠️ Hindi translation skipped:', err);
    }

    // 3. Search English translation (as normal text)
    try {
        const englishQuery = await translateQuery(term, 'en');
        if (englishQuery && englishQuery !== term) {
            let eRes = fuseInstance.search(englishQuery);
            eRes.forEach(r => resultMap.set(r.item.timestamp + (r.item.content || ''), r.item));
        }
    } catch (err) {
        console.warn('⚠️ English translation skipped:', err);
    }

    filteredPosts = Array.from(resultMap.values());
    currentPage = 0;
    document.getElementById('postsContainer').innerHTML = '';
    PostRenderer.renderPosts();
    updateSearchResults(filteredPosts.length, searchTerm);
}

/**
 * Update UI with search results count
 * @param {number} count - Number of results
 * @param {string} searchTerm - Search query
 */
function updateSearchResults(count, searchTerm) {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        if (!searchTerm || count === allPosts.length) {
            searchResults.textContent = '';
            searchResults.style.display = 'none';
        } else {
            searchResults.textContent = `Found ${count} post${count !== 1 ? 's' : ''}`;
            searchResults.style.display = 'block';
        }
    }
}

/**
 * Setup search with debounce and event listeners
 */
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) {
        console.error('❌ Search input not found');
        return;
    }

    // Debounced search (300ms delay)
    const debouncedSearch = Utils.debounce((value) => {
        handleSearch(value);
    }, 300);

    searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });

    // Clear on Escape
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            handleSearch('');
        }
    });

    console.log('✅ Search listeners attached');
}

console.log('✅ Search module loaded');

// Export for other modules
window.Search = {
    initializeSearch,
    handleSearch,
    setupSearch,
    updateSearchResults
};
