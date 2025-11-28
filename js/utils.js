// ============================================
// UTILITY & HELPER FUNCTIONS
// ============================================

// Debounce function - delays execution until user stops typing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function - limits execution rate
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Clean content - removes empty lines and stop phrases
function cleanContent(content) {
    if (!content) return '';
    
    const stopPhrases = [
        // Add any phrases you want to filter out
    ];
    
    const lines = content.split('\n');
    const cleaned = [];
    
    for (let line of lines) {
        const lineLower = line.toLowerCase().trim();
        if (!line.trim()) continue;
        if (stopPhrases.some(phrase => lineLower.includes(phrase))) continue;
        cleaned.push(line);
    }
    
    return cleaned.join('\n');
}

// Process hashtags - make them blue and bold
function processHashtags(text) {
    if (!text) return '';
    return text.replace(/#(\w+)/g, '<span style="color:#385898;font-weight:500">#$1</span>');
}

// Convert Google Drive URLs to embeddable /preview format
// Convert Google Drive URLs to embeddable preview format
function convertGoogleDriveUrl(url) {
    if (!url) return null;
    
    // If it's not a Google Drive URL, return the original URL
    if (!url.includes('drive.google.com')) {
        return url; // Changed from 'return null' to 'return url'
    }
    
    let fileId = null;
    const patterns = [
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,
        /drive\.google\.com\/open\?id=([a-zA-Z0-9-_]+)/,
        /drive\.google\.com\/.*[?&]id=([a-zA-Z0-9-_]+)/,
        /drive\.google\.com\/uc\?export=download&id=([a-zA-Z0-9-_]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            fileId = match[1];
            break;
        }
    }
    
    if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    
    if (url.includes('preview')) {
        return url;
    }
    
    return url; // Return original URL instead of null
}


// Format date for display
function formatDate(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// Format relative time (e.g., "2 hours ago")
function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now();
    const date = new Date(timestamp).getTime();
    const diff = now - date;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
}

// Normalize date for search
function normalizeDateForSearch(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const formats = [
        date.toLocaleDateString('en-US'),
        date.toLocaleDateString('en-GB'),
        date.toDateString(),
        `${date.getDate()} ${date.toLocaleString('en', { month: 'long' })}`,
        date.toLocaleString('en', { month: 'long' }) + ' ' + date.getDate(),
        `${date.getDate()} ${date.toLocaleString('en', { month: 'short' })}`,
        date.toLocaleString('en', { month: 'short' }) + ' ' + date.getDate(),
        date.getFullYear().toString(),
        date.toLocaleString('en', { month: 'long' })
    ];
    
    return formats.join(' ');
}

// Copy text to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            Toastify({
                text: "📋 Copied to clipboard!",
                duration: 2000,
                gravity: "bottom",
                position: "center",
                style: { background: "#1877f2" }
            }).showToast();
        });
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        Toastify({
            text: "📋 Copied to clipboard!",
            duration: 2000,
            gravity: "bottom",
            position: "center",
            style: { background: "#1877f2" }
        }).showToast();
    }
}

// Check if text contains Hindi characters
function containsHindi(text) {
    return /[\u0900-\u097F]/.test(text);
}

console.log('✅ Utils loaded');

// Export for other modules
window.Utils = {
    debounce,
    throttle,
    cleanContent,
    processHashtags,
    convertGoogleDriveUrl,
    formatDate,
    formatRelativeTime,
    normalizeDateForSearch,
    copyToClipboard,
    containsHindi
};