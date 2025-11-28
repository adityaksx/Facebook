// ============================================
// POST RENDERER - Create and display post cards
// ============================================

/**
 * Create a single post card element
 * @param {Object} post - Post data object
 * @returns {HTMLElement} - Post card DOM element
 */
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.setAttribute('data-post-id', post.id);
    card.setAttribute('data-aos', 'fade-up');
    card.setAttribute('data-aos-duration', '500');

    // HEADER
    card.appendChild(createPostHeader(post));

    // ADMIN CONTROLS
    if (isAdmin) {
        card.querySelector('.post-header').appendChild(createAdminControls(post.id));
    }

    // CONTENT
    if (post.content) {
        card.appendChild(createPostContent(post));
    }

    // IMAGES
    if (post.images && post.images.length > 0) {
        card.appendChild(createImageGallery(post));
    }

    // VIDEOS
    if (post.videos && post.videos.length > 0) {
        card.appendChild(createVideoGallery(post));
    }

    // STATS
    card.appendChild(createPostStats(post));

    // ACTIONS
    card.appendChild(createPostActions(post));

    // ADMIN LIKE COUNT
    if (isAdmin) {
        card.appendChild(createAdminLikeCount(post.id));
    }

    // COMMENTS SECTION
    card.appendChild(createCommentsSection(post));

    return card;
}

/**
 * Create post header (avatar, author, time)
 */
function createPostHeader(post) {
    const header = document.createElement('div');
    header.className = 'post-header';
    
    header.innerHTML = `
        <img src="profile.jpg" alt="Profile" class="post-avatar" 
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect fill=%22%23ddd%22/%3E%3C/svg%3E'">
        <div class="post-info">
            <div class="post-author">
                <a href="https://facebook.com/satyapal.28" target="_blank" rel="noopener noreferrer">Satya Pal Singh</a>
            </div>
            <div class="post-time">${post.date || post.timestamp || ''}</div>
        </div>
        <div class="post-options">⋯</div>
    `;
    
    return header;
}

/**
 * Create admin controls (edit/delete buttons)
 */
function createAdminControls(postId) {
    const controls = document.createElement('div');
    controls.className = 'admin-post-controls';
    controls.innerHTML = `
        <button class="admin-edit-post-btn" onclick="editPost('${postId}')">✏️ Edit</button>
        <button class="admin-delete-post-btn" onclick="deletePost('${postId}')">🗑️ Delete</button>
    `;
    return controls;
}

/**
 * Create post content (text)
 */
function createPostContent(post) {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'post-content';
    
    let cleanedContent = Utils.cleanContent(post.content) || '';
    cleanedContent = cleanedContent.replace(/^\s+|\s+$/g, '');
    cleanedContent = cleanedContent.replace(/(\r\n|\n|\r)/g, '<br>');
    cleanedContent = cleanedContent.replace(/(<br\s*\/?>\s*){2,}/g, '<br>');
    cleanedContent = cleanedContent.replace(/<p>\s*<\/p>/gi, '');
    cleanedContent = cleanedContent.replace(/^(<br\s*\/?>)+/i, '');
    
    const textDiv = document.createElement('div');
    textDiv.className = 'post-text';
    textDiv.innerHTML = Utils.processHashtags(Security.sanitizeHTML(cleanedContent));
    contentDiv.appendChild(textDiv);
    
    // Add translation feature if needed
    if (Translation.containsHindi(cleanedContent)) {
        Translation.addTranslationFeature(contentDiv, cleanedContent);
    }
    
    return contentDiv;
}

/**
 * Create image gallery with lazy loading
 */
/**
 * Create image gallery with lazy loading
 */
/**
 * Create image gallery with lazy loading and proper dimensions
 */
function createImageGallery(post) {
    const imagesDiv = document.createElement('div');
    imagesDiv.className = 'post-images';
    imagesDiv.setAttribute('data-pswp-gallery', `post-${post.id}`);
    
    const imageCount = post.images.length;
    
    // Layout class
    const layouts = ['layout-1', 'layout-2', 'layout-3', 'layout-4', 'layout-5plus'];
    imagesDiv.classList.add(imageCount <= 4 ? layouts[imageCount - 1] : layouts[4]);
    
    const displayCount = Math.min(imageCount, 5);
    
    // ⭐ Loop through ALL images
    for (let i = 0; i < imageCount; i++) {
        const imgSrc = post.images[i];
        
        const imgContainer = document.createElement('div');
        imgContainer.className = 'img-container';
        
        const link = document.createElement('a');
        link.href = imgSrc;
        link.setAttribute('data-pswp-src', imgSrc);
        
        // ⭐ CRITICAL: Set default dimensions (required by PhotoSwipe)
        link.setAttribute('data-pswp-width', '1600');
        link.setAttribute('data-pswp-height', '1200');
        
        // ✅ OPTIMIZATION: Use loading="lazy" and decoding="async"
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = `Photo ${i + 1}`;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.classList.add('post-img');
        
        // ⭐ UPDATE TO ACTUAL DIMENSIONS WHEN IMAGE LOADS
        img.onload = function() {
            // Use the actual image dimensions
            link.setAttribute('data-pswp-width', this.naturalWidth);
            link.setAttribute('data-pswp-height', this.naturalHeight);
        };
        
        img.onerror = function() {
            this.style.display = 'none';
            this.parentElement.style.display = 'none';
        };
        
        link.appendChild(img);
        imgContainer.appendChild(link);
        
        // Hide images beyond the 5th
        if (i >= displayCount) {
            imgContainer.style.display = 'none';
        }
        
        // +N overlay on the 5th visible image
        if (i === 4 && imageCount > 5) {
            const overlay = document.createElement('div');
            overlay.className = 'img-overlay';
            overlay.textContent = `+${imageCount - 5}`;
            overlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                link.click();
            });
            imgContainer.appendChild(overlay);
        }
        
        imagesDiv.appendChild(imgContainer);
    }
    
    return imagesDiv;
}



/**
 * Create video gallery
 */
function createVideoGallery(post) {
    const videosDiv = document.createElement('div');
    videosDiv.className = 'post-images';
    const videoCount = post.videos.length;
    
    const layouts = ['layout-1', 'layout-2', 'layout-3', 'layout-4', 'layout-5plus'];
    videosDiv.classList.add(videoCount <= 4 ? layouts[videoCount - 1] : layouts[4]);
    
    const displayCount = Math.min(videoCount, 5);
    
    for (let i = 0; i < displayCount; i++) {
        const videoUrl = post.videos[i];
        const videoContainer = document.createElement('div');
        videoContainer.className = 'img-container';
        
        const embedUrl = Utils.convertGoogleDriveUrl(videoUrl);
        
        if (embedUrl) {
            const iframe = document.createElement('iframe');
            iframe.src = embedUrl;
            iframe.classList.add('post-video-iframe');
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('loading', 'lazy');
            iframe.alt = `Video ${i + 1}`;
            videoContainer.appendChild(iframe);
        } else {
            const videoLink = document.createElement('a');
            videoLink.href = videoUrl;
            videoLink.target = '_blank';
            videoLink.rel = 'noopener noreferrer';
            videoLink.className = 'video-fallback-link';
            videoLink.innerHTML = `
                <div class="video-placeholder">
                    <div class="play-icon">▶</div>
                    <div class="video-text">Click to watch video</div>
                </div>
            `;
            videoContainer.appendChild(videoLink);
        }
        
        if (i === 4 && videoCount > 5) {
            const overlay = document.createElement('div');
            overlay.className = 'img-overlay';
            overlay.textContent = `+${videoCount - 5}`;
            overlay.onclick = () => window.open(videoUrl, '_blank');
            videoContainer.appendChild(overlay);
        }
        
        videosDiv.appendChild(videoContainer);
    }
    
    return videosDiv;
}

/**
 * Create post stats (like/comment counts)
 */
function createPostStats(post) {
    const stats = document.createElement('div');
    stats.className = 'post-stats';
    stats.setAttribute('data-post-id', post.id);
    
    stats.innerHTML = `
        <div class="likes">👍 <span class="like-count">0</span></div>
        <div class="comments-shares"><span class="comment-count">0</span> Comments</div>
    `;
    
    // ✅ Load stats asynchronously (non-blocking)
    requestIdleCallback(() => {
        DataLoader.loadPostStats(post.id, stats.querySelector('.likes'), stats.querySelector('.comments-shares'));
    });
    
    return stats;
}

/**
 * Create post action buttons (like, comment, share)
 */
function createPostActions(post) {
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    
    actions.innerHTML = `
        <button class="action-btn like-btn" title="Like this post">
            <span class="icon">👍</span> Like
        </button>
        <button class="action-btn comment-btn" title="Comment on this post">
            <span class="icon">💬</span> Comment
        </button>
        <button class="action-btn share-btn" title="Share this post">
            <span class="icon">↗️</span> Share
        </button>
    `;
    
    // Add event listeners
    const likeBtn = actions.querySelector('.like-btn');
    const commentBtn = actions.querySelector('.comment-btn');
    const shareBtn = actions.querySelector('.share-btn');
    
    likeBtn.onclick = () => PostActions.handleLike(post.id, likeBtn, actions.closest('.post-card').querySelector('.likes'));
    commentBtn.onclick = () => toggleCommentsSection(post.id);
    shareBtn.onclick = () => {
        Utils.copyToClipboard(window.location.href);
    };
    
    // Check if user liked
    requestIdleCallback(() => {
        PostActions.checkUserLiked(post.id, likeBtn);
    });
    
    return actions;
}

/**
 * Create admin like count box
 */
function createAdminLikeCount(postId) {
    const likeCountDiv = document.createElement('div');
    likeCountDiv.className = 'admin-like-count';
    likeCountDiv.innerHTML = '👍 Loading likes...';
    likeCountDiv.setAttribute('data-post-id', postId);
    
    requestIdleCallback(() => {
        DataLoader.loadLikeCount(postId, likeCountDiv);
    });
    
    return likeCountDiv;
}

/**
 * Create comments section
 */
function createCommentsSection(post) {
    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section';
    commentsSection.style.display = 'none';
    commentsSection.setAttribute('data-post-id', post.id);
    
    commentsSection.innerHTML = `
        <div class="comment-input-container">
            <input type="text" class="comment-input" placeholder="Write a comment..." />
            <button class="comment-submit-btn">Post</button>
        </div>
        <div class="comments-list"></div>
    `;
    
    // Submit handler
    const submitBtn = commentsSection.querySelector('.comment-submit-btn');
    const inputField = commentsSection.querySelector('.comment-input');
    
    submitBtn.onclick = async function() {
        const text = inputField.value.trim();
        if (!text) return;
        
        const commentsList = commentsSection.querySelector('.comments-list');
        await PostActions.submitComment(post.id, text, commentsList);
        inputField.value = '';
    };
    
    return commentsSection;
}

/**
 * Toggle comments section visibility
 */
function toggleCommentsSection(postId) {
    const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    const section = card.querySelector('.comments-section');
    const commentsList = section.querySelector('.comments-list');
    
    if (section.style.display === 'none') {
        section.style.display = 'block';
        DataLoader.loadComments(postId, commentsList);
    } else {
        section.style.display = 'none';
    }
}

/**
 * Render posts to container with performance optimization
 */
function renderPosts() {
    const container = document.getElementById('postsContainer');
    const start = currentPage * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    const postsToRender = filteredPosts.slice(start, end);

    if (!container) {
        console.error('❌ Posts container not found');
        return;
    }

    if (postsToRender.length === 0 && currentPage === 0) {
        container.innerHTML = '<div class="no-posts"><p>No posts to display</p></div>';
        return;
    }

    // ✅ OPTIMIZATION: Use DocumentFragment for batch DOM update
    const fragment = document.createDocumentFragment();
    
    postsToRender.forEach(post => {
        const postCard = createPostCard(post);
        fragment.appendChild(postCard);
    });

    // Single DOM update
    container.appendChild(fragment);
    
    // ✅ Refresh AOS after render
    requestAnimationFrame(() => {
        if (typeof AOS !== 'undefined') {
            AOS.refresh();
            console.log('✅ AOS refreshed');
        }
        
        if (typeof initPhotoSwipe === 'function') {
            initPhotoSwipe();
            console.log('✅ PhotoSwipe reinitialized for new posts');
        }

    });

    currentPage++;
    console.log(`✅ Rendered ${postsToRender.length} posts (page ${currentPage})`);
}

console.log('✅ Post renderer loaded');

// Export for other modules
window.PostRenderer = {
    createPostCard,
    renderPosts,
    toggleCommentsSection
};
