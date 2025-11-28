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

    // MEDIA (images + videos together)
    if ((post.images && post.images.length > 0) || (post.videos && post.videos.length > 0)) {
        card.appendChild(createMediaGallery(post));
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

    // Add "Read more" button if text is long
    // Create a temporary element to measure text length
    const tempDiv = document.createElement('div');
    tempDiv.className = 'post-text';
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.pointerEvents = 'none';
    tempDiv.style.width = textDiv.clientWidth + 'px';
    tempDiv.innerHTML = textDiv.innerHTML;
    document.body.appendChild(tempDiv);

    // If height exceeds approx. 7 lines, show button
    const lineHeight = parseFloat(getComputedStyle(textDiv).lineHeight) || 20;
    const maxVisibleHeight = lineHeight * 7;

    if (tempDiv.scrollHeight > maxVisibleHeight + 5) {
        const btn = document.createElement('button');
        btn.className = 'read-more-btn';
        btn.textContent = 'Read more';

        btn.addEventListener('click', () => {
            const expanded = textDiv.classList.toggle('expanded');
            btn.textContent = expanded ? 'Show less' : 'Read more';
        });

        contentDiv.appendChild(btn);
    }

    // Remove temp element
    document.body.removeChild(tempDiv);
    
    // Add translation feature if needed
    if (Translation.containsHindi(cleanedContent)) {
        Translation.addTranslationFeature(contentDiv, cleanedContent);
    }
    
    return contentDiv;
}


/**
 * Create unified media gallery (images + videos) for PhotoSwipe
 * Supports mixed images + videos in the same gallery and layout
 */
/**
 * Create unified media gallery (images + videos) for PhotoSwipe
 * Fixed: ensures 'thumb' is defined and used safely for video slides
 */
function createMediaGallery(post) {
    const mediaDiv = document.createElement('div');
    mediaDiv.className = 'post-images';
    mediaDiv.setAttribute('data-pswp-gallery', `post-${post.id}`);

    const images = post.images || [];
    const videos = post.videos || [];

    const mediaItems = [];
    images.forEach(src => mediaItems.push({ type: 'image', src }));
    videos.forEach(videoUrl => {
        const embedUrl = (typeof Utils !== 'undefined' && Utils.convertGoogleDriveUrl)
            ? (Utils.convertGoogleDriveUrl(videoUrl) || videoUrl)
            : videoUrl;
        mediaItems.push({ type: 'video', src: embedUrl, original: videoUrl });
    });

    const count = mediaItems.length;
    if (count === 0) return mediaDiv;

    const layouts = ['layout-1', 'layout-2', 'layout-3', 'layout-4', 'layout-5plus'];
    mediaDiv.classList.add(count <= 4 ? layouts[count - 1] : layouts[4]);

    const displayCount = Math.min(count, 5);

    // Path to thumbnail image for videos - put a file at this path or change it
    const defaultVideoThumb = 'video-placeholder.png';

    // tiny 1x1 svg so PhotoSwipe doesn't try to load a real broken image
    const tinySvgDataUri = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';

    for (let i = 0; i < count; i++) {
        const item = mediaItems[i];
        const container = document.createElement('div');
        container.className = 'img-container';

        const link = document.createElement('a');
        link.setAttribute('data-pswp-gallery', `post-${post.id}`);
        link.style.cursor = 'pointer';

        // Define a thumb variable up-front so it's always available
        let thumb = tinySvgDataUri;

        if (item.type === 'image') {
            link.href = item.src;
            link.setAttribute('data-pswp-src', item.src);
            link.setAttribute('data-pswp-width', '1600');
            link.setAttribute('data-pswp-height', '1200');

            const img = document.createElement('img');
            img.src = item.src;
            img.alt = `Photo ${i + 1}`;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.classList.add('post-img');

            img.onload = function() {
                try {
                    link.setAttribute('data-pswp-width', this.naturalWidth || 1600);
                    link.setAttribute('data-pswp-height', this.naturalHeight || 1200);
                } catch (e) {}
            };

            img.onerror = function() {
                this.style.display = 'none';
                this.parentElement.style.display = 'none';
            };

            link.appendChild(img);
            link.setAttribute('data-pswp-msrc', item.src);
            thumb = item.src; // thumbnail for image slides

            } else {
                // Video slide
                const embedUrl = item.src || item.original || '';

                // Use the real URL on the anchor so initPhotoSwipe can see it
                // and the contentLoad handler can detect mp4 and use native <video>.
                const safeUrl = (typeof Security !== 'undefined' && Security.sanitizeURL) ? Security.sanitizeURL(embedUrl) : embedUrl;

                // Set anchor to point to the actual video URL (not '#')
                link.href = safeUrl;
                link.setAttribute('data-type', 'video');

                // <-- IMPORTANT: provide data-video-src so the contentLoad handler can use it -->
                link.setAttribute('data-video-src', safeUrl);

                // Keep compatibility: also mark as HTML slide if your handler uses it
                link.setAttribute('data-pswp-type', 'html');

                // Provide a fallback HTML content (iframe) for non-mp4 embeds (e.g., some providers)
                const iframeHTML = `
                    <div class="pswp__video-wrapper" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;">
                        <iframe
                            src="${safeUrl || ''}"
                            width="100%"
                            height="100%"
                            frameborder="0"
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowfullscreen
                            style="border:0;display:block;width:100%;height:100%;">
                        </iframe>
                    </div>
                `;
                link.setAttribute('data-pswp-html', iframeHTML);

                // determine thumbnail for video slides: prefer defaultVideoThumb if present
                if (defaultVideoThumb) {
                    thumb = defaultVideoThumb;
                } else {
                    thumb = tinySvgDataUri;
                }

                link.setAttribute('data-pswp-msrc', thumb);
                link.setAttribute('data-pswp-src', thumb);
                link.setAttribute('data-pswp-width', '1280');
                link.setAttribute('data-pswp-height', '720');

                const placeholder = document.createElement('div');
                placeholder.className = 'video-placeholder';
                placeholder.innerHTML = `
                    <div class="play-icon">▶</div>
                    <div class="video-text">Video</div>
                `;
                link.appendChild(placeholder);
            }

        // Now that thumb is defined, it's safe to use it anywhere if needed
        // (we already set data-pswp-msrc/data-pswp-src above for video/image branches)

        container.appendChild(link);

        if (i >= displayCount) container.style.display = 'none';

        if (i === 4 && count > 5) {
            const overlay = document.createElement('div');
            overlay.className = 'img-overlay';
            overlay.textContent = `+${count - 5}`;
            overlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const anchor = container.querySelector('a');
                if (anchor) anchor.click();
            });
            container.appendChild(overlay);
        }

        mediaDiv.appendChild(container);
    }

    return mediaDiv;
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
            <input type="text" name="comment" class="comment-input" placeholder="Write a comment..." />
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
