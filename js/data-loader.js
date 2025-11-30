// ============================================
// DATA LOADER - Fetch posts and stats from Supabase
// ============================================

/**
 * Load all posts from Supabase with pagination
 * Fetches posts in batches of 1000 until all are loaded
 */
async function loadAllPosts() {
    const loadingDiv = document.getElementById('loadingIndicator');
    if (loadingDiv) loadingDiv.style.display = 'block';

    // Fetch ALL posts using pagination
    let allFetchedPosts = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabaseClient
            .from('posts')
            .select(`
                id,
                timestamp,
                type,
                content,
                images:images ( url ),
                post_links:post_links ( url ),
                post_videos:post_videos ( url )
            `)
            .order('timestamp', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
            console.error('❌ Error loading posts from Supabase:', error);
            if (window.posthog) {
                posthog.captureException(err, {
                    func: 'loadAllPosts',
                    postId
                });
            }
            if (loadingDiv) {
                loadingDiv.textContent = 'Error loading posts.';
            }
            break;
        }

        if (data && data.length > 0) {
            allFetchedPosts = allFetchedPosts.concat(data);
            console.log(`✅ Loaded page ${page + 1}: ${data.length} posts (Total: ${allFetchedPosts.length})`);
            page++;
            hasMore = data.length === PAGE_SIZE;
        } else {
            hasMore = false;
        }
    }

    // Map DB rows into the same shape your old JSON posts had
    allPosts = (allFetchedPosts || []).map(p => {
        const images = (p.images || []).map(img => img.url);
        const links = (p.post_links || []).map(l => l.url);
        const videos = (p.post_videos || []).map(v => v.url);
        const ts = p.timestamp ? new Date(p.timestamp) : null;

        const dateStr = ts ? ts.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }) : '';

        return {
            id: p.id,
            timestamp: p.timestamp,
            type: p.type || '',
            content: p.content || '',
            images,
            videos,
            links,
            date: dateStr
        };
    });

    filteredPosts = [...allPosts];

    if (loadingDiv) loadingDiv.style.display = 'none';

    const totalPostsEl = document.getElementById('totalPosts');
    if (totalPostsEl) totalPostsEl.textContent = allPosts.length;

    console.log(`✅ Successfully loaded ${allPosts.length} total posts`);

    // Initialize dependent features
    if (typeof Search !== 'undefined' && Search.initializeSearch) {
        Search.initializeSearch();
    }
    if (typeof setupSearch === 'function') setupSearch();
    if (typeof renderPosts === 'function') renderPosts();
    if (typeof loadPhotoGrid === 'function') loadPhotoGrid();
}

/**
 * Load post statistics (likes and comments count)
 * @param {string} postId - The post ID
 * @param {HTMLElement} likesDiv - Element to display like count
 * @param {HTMLElement} commentsDiv - Element to display comment count
 */
async function loadPostStats(postId, likesDiv, commentsDiv) {
    try {
        const [likes, comments] = await Promise.all([
            supabaseClient.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
            supabaseClient.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId)
        ]);
        
        const likeSpan = likesDiv.querySelector('.like-count');
        const commentSpan = commentsDiv.querySelector('.comment-count');
        
        if (likeSpan) likeSpan.textContent = likes.count || 0;
        if (commentSpan) commentSpan.textContent = comments.count || 0;
    } catch (err) {
        console.error('❌ Stats error:', err);
        if (window.posthog) {
            posthog.captureException(err, {
                func: 'loadPostStats',
                postId
            });
        }
    }
}

/**
 * Load all comments for a specific post
 * @param {string} postId - The post ID
 * @param {HTMLElement} containerElement - Element to render comments into
 */
async function loadComments(postId, containerElement) {
    const { data, error } = await supabaseClient
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
  
    if (error) {
        console.error('❌ Error loading comments:', error);
        if (window.posthog) {
            posthog.captureException(err, {
                func: 'loadComments',
                postId
            });
        }
        return;
    }
  
    containerElement.innerHTML = '';
  
    if (data && data.length > 0) {
        data.forEach(comment => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'comment-item';
            commentDiv.setAttribute('data-comment-id', comment.id);
      
            const time = new Date(comment.created_at).toLocaleString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric'
            });
      
            commentDiv.innerHTML = `
                <div class="comment-content">
                    <div class="comment-author">${Security.sanitizeHTML(comment.username || 'Anonymous')}</div>
                    <div class="comment-text">${Security.sanitizeHTML(comment.message)}</div>
                    <div class="comment-time">${time}</div>
                </div>
                ${isAdmin ? `<button class="admin-delete-comment-btn" onclick="deleteComment('${comment.id}', '${postId}')">🗑️ Delete</button>` : ''}
            `;
      
            containerElement.appendChild(commentDiv);
        });
    } else {
        containerElement.innerHTML = '<div class="no-comments">No comments yet. Be the first!</div>';
    }
}

/**
 * Load like count and users who liked (admin only)
 * @param {string} postId - The post ID
 * @param {HTMLElement} element - Element to display like count
 */
async function loadLikeCount(postId, element) {
    try {
        // Fetch all likes for this post
        const { data, error, count } = await supabaseClient
            .from('likes')
            .select('id, username, created_at, user_id', { count: 'exact' })
            .eq('post_id', postId)
            .order('created_at', { ascending: false });
    
        if (error) {
            console.error('❌ Error loading likes:', error);
            if (window.posthog) {
                posthog.captureException(err, {
                    func: 'loadLikeCount',
                    postId
                });
            }
            element.innerHTML = '❌ Error loading likes';
            return;
        }
    
        const likeCount = count || 0;
    
        if (likeCount === 0) {
            element.innerHTML = '👍 <strong>0 Likes</strong>';
            element.style.cursor = 'default';
            element.onclick = null;
            return;
        }
    
        // Update the blue box with current count
        element.innerHTML = `👍 <strong>${likeCount} Like${likeCount !== 1 ? 's' : ''}</strong> | <span class="view-likes-link">Click to see who liked</span>`;
        element.style.cursor = 'pointer';
    
        // Add click handler to show who liked
        element.onclick = function(e) {
            e.stopPropagation();
            showLikeDetails(postId, data);
        };
    
        console.log(`✅ Loaded ${likeCount} likes for post ${postId}`);
    
    } catch (err) {
        console.error('❌ Like count error:', err);
        if (window.posthog) {
            posthog.captureException(err, {
                func: 'loadLikeCount',
                postId
            });
        }
        element.innerHTML = '❌ Error loading likes';
    }
}

/**
 * Show detailed list of users who liked a post
 * @param {string} postId - The post ID
 * @param {Array} likes - Array of like objects
 */
function showLikeDetails(postId, likes) {
    if (!likes || likes.length === 0) {
        Toastify({
            text: "No likes yet",
            duration: 2000,
            gravity: "top",
            position: "center",
            style: { background: "#2196F3" }
        }).showToast();
        return;
    }

    let details = `${likes.length} Like${likes.length !== 1 ? 's' : ''} for this post:\n\n`;
    
    likes.forEach((like, index) => {
        const time = new Date(like.created_at).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        details += `${index + 1}. ${like.username || 'Anonymous'} - Liked at ${time}\n`;
    });

    alert(details);
}

console.log('✅ Data loader initialized');

// Export for other modules
window.DataLoader = {
    loadAllPosts,
    loadPostStats,
    loadComments,
    loadLikeCount,
    showLikeDetails
};
