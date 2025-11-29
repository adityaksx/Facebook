// ============================================
// POST RENDERER - Create and display post cards
// ============================================

/**
 * Create a single post card element
 * @param {Object} post - Post data object
 * @returns {HTMLElement} - Post card DOM element
 */
function createPostCard(post) {
  const card = document.createElement("div");
  card.className = "post-card";
  card.setAttribute("data-post-id", post.id);
  card.setAttribute("data-aos", "fade-up");
  card.setAttribute("data-aos-duration", "500");

  // Header
  card.appendChild(createPostHeader(post));

  // Admin controls
  if (isAdmin) {
    const header = card.querySelector(".post-header");
    if (header) header.appendChild(createAdminControls(post.id));
  }

  // Content
  if (post.content) {
    card.appendChild(createPostContent(post));
  }

  // Media (images + videos together)
  if ((post.images && post.images.length) || (post.videos && post.videos.length)) {
    card.appendChild(createMediaGallery(post));
  }

  // Stats
  card.appendChild(createPostStats(post));

  // Actions
  card.appendChild(createPostActions(post));

  // Admin like count
  if (isAdmin) {
    card.appendChild(createAdminLikeCount(post.id));
  }

  // Comments section
  card.appendChild(createCommentsSection(post));

  return card;
}

/**
 * Create post header (avatar, author, time)
 */
function createPostHeader(post) {
  const header = document.createElement("div");
  header.className = "post-header";

  header.innerHTML = `
    <img
      src="profile.jpg"
      alt="Profile"
      class="post-avatar"
      onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect fill=%22%23ddd%22/%3E%3C/svg%3E'">
    <div class="post-info">
      <div class="post-author">
        <a href="https://facebook.com/satyapal.28" target="_blank" rel="noopener noreferrer">Satya Pal Singh</a>
      </div>
      <div class="post-time">${post.date || post.timestamp || ""}</div>
    </div>
    <div class="post-options">⋯</div>
  `;
  return header;
}

/**
 * Create admin controls (edit/delete buttons)
 */
function createAdminControls(postId) {
  const controls = document.createElement("div");
  controls.className = "admin-post-controls";
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
  const contentDiv = document.createElement("div");
  contentDiv.className = "post-content";

  let cleanedContent = Utils.cleanContent(post.content) || "";
  cleanedContent = cleanedContent.replace(/^\s+|\s+$/g, "");
  cleanedContent = cleanedContent.replace(/(\r\n|\n|\r)/g, "<br>");
  cleanedContent = cleanedContent.replace(/(<br\s*\/?>\s*){2,}/g, "<br>");
  cleanedContent = cleanedContent.replace(/<p>\s*<\/p>/gi, "");
  cleanedContent = cleanedContent.replace(/^(<br\s*\/?>)+/i, "");

  const textDiv = document.createElement("div");
  textDiv.className = "post-text";
  textDiv.innerHTML = Utils.processHashtags(Security.sanitizeHTML(cleanedContent));
  contentDiv.appendChild(textDiv);

  // Measure height to decide "Read more"
  const tempDiv = document.createElement("div");
  tempDiv.className = "post-text";
  tempDiv.style.position = "absolute";
  tempDiv.style.visibility = "hidden";
  tempDiv.style.pointerEvents = "none";
  tempDiv.style.width = textDiv.clientWidth + "px";
  tempDiv.innerHTML = textDiv.innerHTML;
  document.body.appendChild(tempDiv);

  // Measure heights
  const visibleHeight = textDiv.clientHeight;          // what the user actually sees
  const fullHeight = tempDiv.scrollHeight;            // full content height

  // Controls: how many lines should be visible before truncation
  const lineHeight = parseFloat(getComputedStyle(textDiv).lineHeight) || 20;
  const maxVisibleHeight = lineHeight * 7;

  // Also require a minimum length so very short texts never get the button
  const minCharsForReadMore = 140;
  const plainTextLength = cleanedContent.replace(/<br\s*\/?>/gi, '').length;

  // Show button only if:
  // - content is taller than what we allow
  // - AND visibly clipped (fullHeight > visibleHeight)
  // - AND long enough in characters
  const shouldHaveReadMore =
    fullHeight > maxVisibleHeight + 5 &&
    fullHeight > visibleHeight + 5 &&
    plainTextLength > minCharsForReadMore;

  if (shouldHaveReadMore) {
    const btn = document.createElement('button');
    btn.className = 'read-more-btn';
    btn.textContent = 'Read more';

    btn.addEventListener('click', () => {
      const expanded = textDiv.classList.toggle('expanded');
      btn.textContent = expanded ? 'Show less' : 'Read more';
    });

    contentDiv.appendChild(btn);
  }


  document.body.removeChild(tempDiv);

  // Translation feature
  if (Translation.containsHindi(cleanedContent)) {
    Translation.addTranslationFeature(contentDiv, cleanedContent);
  }

  return contentDiv;
}

/**
 * Create unified media gallery (images + videos) for PhotoSwipe
 * Supports mixed images + videos in the same gallery and layout.
 */
function createMediaGallery(post) {
  const wrapper = document.createElement('div');
  wrapper.className = 'post-media';

  const images = post.images || [];
  const videos = post.videos || [];

  /* 1) IMAGE GRID + PHOTOSWIPE (unchanged logic) */
  if (images.length) {
    const mediaDiv = document.createElement('div');
    mediaDiv.className = 'post-images';
    mediaDiv.setAttribute('data-pswp-gallery', `post-${post.id}`);

    const mediaItems = images.map(src => ({ type: 'image', src }));
    const count = mediaItems.length;

    const layouts = ['layout-1', 'layout-2', 'layout-3', 'layout-4', 'layout-5plus'];
    mediaDiv.classList.add(count <= 4 ? layouts[count - 1] : layouts[4]);

    const displayCount = Math.min(count, 5);

    for (let i = 0; i < count; i++) {
      const item = mediaItems[i];
      const container = document.createElement('div');
      container.className = 'img-container';

      const link = document.createElement('a');
      link.setAttribute('data-pswp-gallery', `post-${post.id}`);
      link.style.cursor = 'pointer';

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

      img.onload = function () {
        try {
          link.setAttribute('data-pswp-width', this.naturalWidth || 1600);
          link.setAttribute('data-pswp-height', this.naturalHeight || 1200);
        } catch (e) {}
      };

      img.onerror = function () {
        this.style.display = 'none';
        if (this.parentElement) this.parentElement.style.display = 'none';
      };

      link.appendChild(img);
      link.setAttribute('data-pswp-msrc', item.src);

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

    wrapper.appendChild(mediaDiv);
  }

  /* 2) VIDEOS – first as player, others as links */
  if (videos.length) {
    const videosDiv = document.createElement('div');
    videosDiv.className = 'post-videos';

    const normalizeUrl = (url) =>
      (typeof Utils !== 'undefined' && Utils.convertGoogleDriveUrl)
        ? (Utils.convertGoogleDriveUrl(url) || url)
        : url;

    const firstUrl = normalizeUrl(videos[0]);

    // First video as full player
    const vContainer = document.createElement('div');
    vContainer.className = 'video-container';

    const video = document.createElement('video');
    video.src = firstUrl;
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.style.width = '100%';
    video.style.maxHeight = '480px';
    video.addEventListener('error', () => {
      vContainer.innerHTML = `
        <div class="video-error">
          Video failed to load.
          <a href="${firstUrl}" target="_blank" rel="noopener">Open in new tab</a>
        </div>`;
    });

    vContainer.appendChild(video);
    videosDiv.appendChild(vContainer);

    // Extra videos as simple links
    if (videos.length > 1) {
      const list = document.createElement('div');
      list.className = 'extra-videos';

      videos.slice(1).forEach((url, idx) => {
        const linkUrl = normalizeUrl(url);
        const a = document.createElement('a');
        a.href = linkUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'extra-video-link';
        a.textContent = `Open video ${idx + 2}`;
        list.appendChild(a);
      });

      videosDiv.appendChild(list);
    }

    wrapper.appendChild(videosDiv);
  }

  // Track image views when images enter viewport
  if (window.posthog && 'IntersectionObserver' in window) {
    const imgObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const postCard = entry.target.closest('.post-card');
          const postId = postCard && postCard.getAttribute('data-post-id');
          if (postId) {
            posthog.capture('view_image', { post_id: postId });
          }
          obs.unobserve(entry.target); // only first view per image
        }
      });
    }, { threshold: 0.6 });

    wrapper.querySelectorAll('img.post-img').forEach(img => imgObserver.observe(img));
  }

  return wrapper;
}

/**
 * Create post stats (like/comment counts)
 */
function createPostStats(post) {
  const stats = document.createElement("div");
  stats.className = "post-stats";
  stats.setAttribute("data-post-id", post.id);

  stats.innerHTML = `
    <div class="likes">👍 <span class="like-count">0</span></div>
    <div class="comments-shares"><span class="comment-count">0</span> Comments</div>
  `;

  return stats;
}

/**
 * Create post action buttons (like, comment, share)
 */
function createPostActions(post) {
  const actions = document.createElement("div");
  actions.className = "post-actions";

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

  const likeBtn = actions.querySelector(".like-btn");
  const commentBtn = actions.querySelector(".comment-btn");
  const shareBtn = actions.querySelector(".share-btn");

  likeBtn.onclick = () => {
    PostActions.handleLike(
      post.id,
      likeBtn,
      actions.closest(".post-card").querySelector(".likes")
    );

    // PostHog: track like
    if (window.posthog) {
      posthog.capture('like_post', { post_id: post.id });
    }
  };

  commentBtn.onclick = () => toggleCommentsSection(post.id);

  shareBtn.onclick = () => {
      // Create shareable URL with post ID as URL parameter
      const shareUrl = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
      Utils.copyToClipboard(shareUrl);
      
      // ✅ ADD THIS: Track share action
      if (window.posthog) {
        posthog.capture('share_post', {
          post_id: post.id,
          via: 'copy_link'
        });
      }
      Toastify({
          text: "📋 Post link copied to clipboard!",
          duration: 2500,
          gravity: "bottom",
          position: "center",
          style: { background: "#1877f2" }
      }).showToast();
  };


  requestIdleCallback(() => {
    PostActions.checkUserLiked(post.id, likeBtn);
  });

  return actions;
}

/**
 * Create admin like count box
 */
function createAdminLikeCount(postId) {
  const likeCountDiv = document.createElement("div");
  likeCountDiv.className = "admin-like-count";
  likeCountDiv.innerHTML = "👍 Loading likes...";
  likeCountDiv.setAttribute("data-post-id", postId);

  requestIdleCallback(() => {
    DataLoader.loadLikeCount(postId, likeCountDiv);
  });

  return likeCountDiv;
}

/**
 * Create comments section
 */
function createCommentsSection(post) {
  const commentsSection = document.createElement("div");
  commentsSection.className = "comments-section";
  commentsSection.style.display = "none";
  commentsSection.setAttribute("data-post-id", post.id);

  commentsSection.innerHTML = `
    <div class="comment-input-container">
      <input type="text" name="comment" class="comment-input" placeholder="Write a comment..." />
      <button class="comment-submit-btn">Post</button>
    </div>
    <div class="comments-list"></div>
  `;

  const submitBtn = commentsSection.querySelector(".comment-submit-btn");
  const inputField = commentsSection.querySelector(".comment-input");

  submitBtn.onclick = async () => {
    const text = inputField.value.trim();
    if (!text) return;

    const commentsList = commentsSection.querySelector(".comments-list");
    await PostActions.submitComment(post.id, text, commentsList);
    inputField.value = "";
  };

  return commentsSection;
}

/**
 * Toggle comments section visibility
 */
function toggleCommentsSection(postId) {
  const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
  if (!card) return;

  const section = card.querySelector(".comments-section");
  const commentsList = section.querySelector(".comments-list");

  if (section.style.display === "none") {
    section.style.display = "block";
    DataLoader.loadComments(postId, commentsList);
  } else {
    section.style.display = "none";
  }
}

/**
 * Render posts to container with performance optimization
 */
/**
 * Render posts to container with performance optimization
 */
function renderPosts() {
  const container = document.getElementById('postsContainer');
  if (!container) {
    console.error('❌ Posts container not found');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const singlePostId = params.get('post');

  // ========================================
  // SINGLE-POST MODE (view one specific post)
  // ========================================
  if (singlePostId) {
    container.innerHTML = '';  // clear for single post view

    const post = filteredPosts.find(p => String(p.id) === String(singlePostId));

    if (!post) {
      container.innerHTML = '<div class="no-posts"><p>Post not found</p></div>';
      return;
    }

    const card = createPostCard(post);
    container.appendChild(card);

    // Add "back to all posts" button
    const backCard = document.createElement('div');
    backCard.className = 'post-card back-to-home-card';
    backCard.innerHTML = `
      <div class="post-content" style="text-align:center; padding:16px;">
        <p style="margin-bottom:12px;">You are viewing a single post.</p>
        <button id="backToHomeBtn"
          style="
            padding:8px 16px;
            border-radius:4px;
            border:none;
            background:#1877f2;
            color:#fff;
            cursor:pointer;
          ">
          ← Back to all posts
        </button>
      </div>
    `;
    container.appendChild(backCard);

    const backBtn = backCard.querySelector('#backToHomeBtn');
    backBtn.onclick = () => {
      window.location.href = window.location.pathname;
    };

    // Disable AOS animations in single-post mode
    const aosElems = container.querySelectorAll('[data-aos]');
    aosElems.forEach(el => {
      el.removeAttribute('data-aos');
      el.removeAttribute('data-aos-duration');
    });

    if (typeof initPhotoSwipe === 'function') {
      initPhotoSwipe();
    }

    window.currentPage = 1;
    return;
  }

  // ========================================
  // FEED MODE (paginated, infinite scroll)
  // ========================================

  // Check if posts exist
  if (!filteredPosts || filteredPosts.length === 0) {
    if (window.currentPage === 0) {
      container.innerHTML = '<div class="no-posts"><p>No posts to display</p></div>';
    }
    return;
  }

  // Sort newest → oldest (stable)
  filteredPosts.sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || 0).getTime();
    return tb - ta;
  });

  // Initialize currentPage if needed
  if (typeof window.currentPage === 'undefined') {
    window.currentPage = 0;
  }

  // Calculate current page slice
  const start = window.currentPage * POSTS_PER_PAGE;
  const end   = start + POSTS_PER_PAGE;
  const postsToRender = filteredPosts.slice(start, end);

  // Nothing more to render
  if (postsToRender.length === 0) return;

  // Build and append only this page
  const fragment = document.createDocumentFragment();
  postsToRender.forEach(post => {
    const postCard = createPostCard(post);
    fragment.appendChild(postCard);
  });
  container.appendChild(fragment);

  // Setup viewport observer for newly added cards
  setupViewportObserver();

  // ✅ ADD THIS: Reinitialize PhotoSwipe for new posts
  if (typeof initPhotoSwipe === 'function') {
    initPhotoSwipe();
  }

  // Refresh AOS animations
  requestAnimationFrame(() => {
    if (typeof AOS !== 'undefined') {
      AOS.refresh();
    }
  });

  // Move to next page
  window.currentPage++;
}

// =========================
// Viewport manager: load data only for posts near user
// =========================

let viewportObserver = null;

function setupViewportObserver() {
  if (!('IntersectionObserver' in window)) return;

  if (viewportObserver) viewportObserver.disconnect();

  viewportObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const card = entry.target;
      const postId = card.getAttribute('data-post-id');
      if (!postId) return;

      if (entry.isIntersecting) {
        handlePostVisible(card, postId);
      }
    });
  }, {
    root: null,
    rootMargin: '200px 0px 400px 0px', // start a bit before/after
    threshold: 0.25
  });

  document.querySelectorAll('.post-card[data-post-id]').forEach(card => {
    viewportObserver.observe(card);
  });
}

// Called when a post is at / near the viewport
function handlePostVisible(card, postId) {
  // 1) Analytics: view_post (only once)
  if (window.posthog && !card.__ph_view_tracked) {
    posthog.capture('view_post', { post_id: postId });
    card.__ph_view_tracked = true;
  }

  // 2) Stats: likes + comments for this post (only once)
  if (!card.__stats_loaded) {
    const likesDiv = card.querySelector('.likes');
    const commentsDiv = card.querySelector('.comments-shares');
    if (window.DataLoader && typeof DataLoader.loadPostStats === 'function' && likesDiv && commentsDiv) {
      DataLoader.loadPostStats(postId, likesDiv, commentsDiv);
    }
    card.__stats_loaded = true;
  }

  // If later you lazy‑render heavy media, trigger it here too.
}

console.log("✅ Post renderer loaded");

window.PostRenderer = {
  createPostCard,
  renderPosts,
  toggleCommentsSection
};

