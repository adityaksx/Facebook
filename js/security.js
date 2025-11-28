// ============================================
// SECURITY: XSS Protection & Input Validation
// ============================================

/**
 * Sanitizes HTML to prevent XSS attacks while preserving safe formatting tags
 * @param {string} str - The string to sanitize
 * @returns {string} - Sanitized HTML-safe string with allowed tags preserved
 */
function sanitizeHTML(str) {
    if (!str) return '';
    
    // First, escape ALL HTML
    const temp = document.createElement('div');
    temp.textContent = str;
    let sanitized = temp.innerHTML;
    
    // Then, restore SAFE <br> tags
    sanitized = sanitized
        .replace(/&lt;br&gt;/gi, '<br>')
        .replace(/&lt;br\/&gt;/gi, '<br>')
        .replace(/&lt;br \/&gt;/gi, '<br>');
    
    return sanitized;
}

/**
 * Escape HTML entities for display
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string
 */
function escapeHTML(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;'
    };
    return String(str).replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Validate and sanitize URL to prevent javascript: and data: URLs
 * @param {string} url - The URL to validate
 * @returns {string|null} - Safe URL or null if invalid
 */
function sanitizeURL(url) {
    if (!url) return null;
    
    // Remove whitespace
    url = url.trim();
    
    // Block dangerous protocols
    const dangerousProtocols = /^(javascript|data|vbscript|file):/i;
    if (dangerousProtocols.test(url)) {
        console.warn('⚠️ Blocked dangerous URL:', url);
        return null;
    }
    
    // Only allow http, https, and relative URLs
    const safeProtocols = /^(https?:)?\/\//i;
    if (!safeProtocols.test(url) && !url.startsWith('/')) {
        console.warn('⚠️ Invalid URL protocol:', url);
        return null;
    }
    
    return url;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Rate limiter for actions (prevent spam)
 * @param {string} key - Unique key for this action
 * @param {number} maxRequests - Max requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - True if action is allowed
 */
const rateLimiters = new Map();

function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    
    if (!rateLimiters.has(key)) {
        rateLimiters.set(key, []);
    }
    
    const requests = rateLimiters.get(key);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
        console.warn(`⚠️ Rate limit exceeded for: ${key}`);
        return false;
    }
    
    validRequests.push(now);
    rateLimiters.set(key, validRequests);
    
    return true;
}

/**
 * Validate input length
 * @param {string} input - Input to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {boolean} - True if valid
 */
function validateInputLength(input, maxLength = 5000) {
    if (!input) return true;
    if (input.length > maxLength) {
        console.warn(`⚠️ Input too long: ${input.length} > ${maxLength}`);
        return false;
    }
    return true;
}

/**
 * Sanitize filename for uploads
 * @param {string} filename - Original filename
 * @returns {string} - Safe filename
 */
function sanitizeFilename(filename) {
    if (!filename) return 'file';
    
    // Remove path traversal attempts
    filename = filename.replace(/\.\./g, '');
    
    // Remove special characters
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Limit length
    if (filename.length > 255) {
        const ext = filename.split('.').pop();
        filename = filename.substring(0, 250) + '.' + ext;
    }
    
    return filename;
}

/**
 * Content Security Policy helper
 * Add CSP meta tag if not present
 */
function enforceCSP() {
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;";
        document.head.appendChild(meta);
    }
}

console.log('✅ Security module loaded');

// Export for other modules
window.Security = {
    sanitizeHTML,
    escapeHTML,
    sanitizeURL,
    isValidEmail,
    checkRateLimit,
    validateInputLength,
    sanitizeFilename,
    enforceCSP
};
