// Supabase client
const supabaseUrl = window.SUPABASE_URL;
const supabaseAnonKey = window.SUPABASE_ANON_KEY;
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

const JSON_DATA_FOLDER = 'facebook_json_data';
const AVAILABLE_YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

let allPosts = [];
let filteredPosts = [];
let currentPage = 0;
const POSTS_PER_PAGE = 10;
// Translation rate limiting
let translationRequestCount = 0;
const MAX_TRANSLATIONS_PER_MINUTE = 10;

// ============================================
// SECURITY: XSS Protection (IMPROVED VERSION)
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
    // This converts &lt;br&gt; back to <br>
    sanitized = sanitized
        .replace(/&lt;br&gt;/gi, '<br>')
        .replace(/&lt;br\/&gt;/gi, '<br>')
        .replace(/&lt;br \/&gt;/gi, '<br>');
    
    return sanitized;
}

// ============================================
// USER TRACKING & SESSION MANAGEMENT
// ============================================

// Generate or retrieve user ID
function getUserId() {
    let userId = localStorage.getItem('fb_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('fb_user_id', userId);
        localStorage.setItem('fb_session_start', new Date().toISOString());
    }
    return userId;
}

// Get or prompt for username (only when first interaction happens)
function getUsername() {
    let username = localStorage.getItem('fb_username');
    if (!username) {
        username = prompt('Enter your name (optional - you can skip):');
        if (!username || username.trim() === '') {
            username = 'Anonymous_' + Math.random().toString(36).substr(2, 5);
        }
        localStorage.setItem('fb_username', username.trim());
    }
    return username;
}

// Track user activity
async function logUserActivity(action, postId) {
    const userId = getUserId();
    const username = getUsername();
    const sessionStart = localStorage.getItem('fb_session_start'); 
    console.log('User Activity:', {
        userId,
        username,
        action,
        postId,
        timestamp: new Date().toISOString()
    });

    // Store in database
    try {
        await supabaseClient
            .from('user_activity')
        .insert([{
            user_id: userId,
            username: username,
            action: action,
            post_id: postId,
            session_start: sessionStart,
            created_at: new Date().toISOString()
        }]);
    } catch (err) {
        console.error('Activity log error:', err);
    }
    // You can extend this to send to a user_activity table if needed
}





// Debounce function
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

// Throttle function
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

document.addEventListener('DOMContentLoaded', function() {
    setupYearFilter();
    loadAllPosts();  // This will now initialize search automatically
    setupImageModal();
    setupScrollLoading();
    setupLazyLoadingWithBlur();
});


function setupYearFilter() {
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) return;  // ADD: Null check
    
    // ADD: Clear existing options to prevent duplicates
    yearFilter.innerHTML = '<option value="all">All Years</option>';

    AVAILABLE_YEARS.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
    yearFilter.addEventListener('change', function() {
        const selectedYear = this.value;
        if (selectedYear === 'all') {
            filteredPosts = [...allPosts];
        } else {
            filteredPosts = allPosts.filter(post => {
                const postYear = new Date(post.timestamp || post.date).getFullYear();
                return postYear === parseInt(selectedYear);
            });
        }
        currentPage = 0;
        document.getElementById('postsContainer').innerHTML = '';
        renderPosts();
    });
}

// ---------- COMPLETE loadAllPosts() WITH PAGINATION ----------
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
            console.error('Error loading posts from Supabase:', error);
            if (loadingDiv) {
                loadingDiv.textContent = 'Error loading posts.';
            }
            break;
        }

        if (data && data.length > 0) {
            allFetchedPosts = allFetchedPosts.concat(data);
            console.log(`Loaded page ${page + 1}: ${data.length} posts (Total: ${allFetchedPosts.length})`);
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

    console.log(`Successfully loaded ${allPosts.length} total posts`);

    if (typeof initializeSearch === 'function') initializeSearch();
    if (typeof setupSearch === 'function') setupSearch();
    if (typeof renderPosts === 'function') renderPosts();
    if (typeof loadPhotoGrid === 'function') loadPhotoGrid();
}




function renderPosts() {
    const container = document.getElementById('postsContainer');
    const start = currentPage * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    const postsToRender = filteredPosts.slice(start, end);

    if (!container) {
        console.error('Posts container not found');
        return;
    }
    
    if (postsToRender.length === 0 && currentPage === 0) {
        container.innerHTML = '<div class="no-posts"><p>No posts to display</p></div>';
        return;
    }

    // Build all post nodes first, keep them in an array
    const fragment = document.createDocumentFragment();
    postsToRender.forEach((post) => {
        const postCard = createPostCard(post);
        postCard.setAttribute('data-post-id', post.id);
        fragment.appendChild(postCard);
    });

    // Append fragment once (preserves order)
    container.appendChild(fragment);

    // Optionally trigger a small staggered animation if you want fade-in staggering:
    const newCards = container.querySelectorAll('.post-card');
    // only animate the cards in this "page" (last POSTS_PER_PAGE appended)
    const total = newCards.length;
    const startIndex = Math.max(0, total - postsToRender.length);
    newCards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        // requestAnimationFrame to ensure CSS transition kicks in
        requestAnimationFrame(() => {
            setTimeout(() => {
                card.style.transition = 'opacity 300ms ease, transform 300ms ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, (i - startIndex) * 40);
        });
    });
    setupLazyLoadingWithBlur();
    currentPage++;
}


async function loadLikeCount(postId, element) {
    try {
        // Fetch all likes for this post
        const { data, error, count } = await supabaseClient
            .from('likes')
            .select('id, username, created_at, user_id', { count: 'exact' })
            .eq('post_id', postId)
            .order('created_at', { ascending: false });
    
        if (error) {
            console.error('Error loading likes:', error);
            element.innerHTML = '❌ Error loading likes';
            return;
        }
    
        const likeCount = count || 0;
    
        if (likeCount === 0) {
            element.innerHTML = '👍 <strong>0 Likes</strong>';
            element.style.cursor = 'default';
            element.onclick = null; // Remove click handler when no likes
            console.log('✅ No likes for post:', postId);
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
        console.error('Like count error:', err);
        element.innerHTML = '❌ Error loading likes';
    }
}



function showLikeDetails(postId, likes) {
    if (!likes || likes.length === 0) {
        alert('No likes yet');
        return;
    }
  
    let details = `👍 ${likes.length} Like${likes.length !== 1 ? 's' : ''} for this post:\n\n`;
    likes.forEach((like, index) => {
        const time = new Date(like.created_at).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        details += `${index + 1}. ${like.username || 'Anonymous'}\n   Liked at: ${time}\n\n`;
    });
  
    alert(details);
}

// ============================================
// COMMENT FUNCTIONS
// ============================================
async function loadComments(postId, containerElement) {
    const { data, error } = await supabaseClient
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
  
    if (error) {
        console.error('Error loading comments:', error);
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
                <div class="comment-author">${sanitizeHTML(comment.username || 'Anonymous')}</div>
                <div class="comment-text">${sanitizeHTML(comment.message)}</div>
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

async function deleteComment(commentId, postId) {
  if (!isAdmin) {
    alert('Only admins can delete comments');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this comment?')) {
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('comments')
      .delete()
      .eq('id', commentId);
    
    if (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
      return;
    }
    
    alert('Comment deleted successfully');
    
    // Reload comments
    const commentsList = document.querySelector(`[data-post-id="${postId}"] .comments-list`);
    if (commentsList) {
      loadComments(postId, commentsList);
    }
  } catch (err) {
    console.error('Delete comment error:', err);
    alert('Failed to delete comment');
  }
}

// Make function global so onclick can access it
window.deleteComment = deleteComment;


async function submitComment(postId, message, containerElement) {
    const userId = getUserId();
    const username = getUsername();
    
    try {
        const { data, error } = await supabaseClient
            .from('comments')
            .insert([{
                post_id: postId,
                username: username,
                message: message,
                created_at: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('Error inserting comment:', error);
            alert('Could not post comment. Please try again.');
        } else {
            console.log('✅ Comment posted successfully');
            logUserActivity('COMMENT', postId);
            
            // ✅ UPDATE COMMENT COUNT
            const { count } = await supabaseClient
                .from('comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', postId);
            
            // Find the post card and update comment count
            const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            if (postCard) {
                const commentSpan = postCard.querySelector('.comment-count');
                if (commentSpan) {
                    commentSpan.textContent = count || 0;
                    console.log('✅ Updated comment count to:', count);
                }
            }
            
            // Reload comments list
            loadComments(postId, containerElement);
        }
    } catch (err) {
        console.error('Comment error:', err);
    }
}


// ============================================
// ADMIN POST MANAGEMENT FUNCTIONS
// ============================================

async function editPost(postId) {
  if (!isAdmin) {
    alert('Only admins can edit posts');
    return;
  }
  
  // Fetch current post data
  const { data: post, error } = await supabaseClient
    .from('posts')
    .select('*, images(*), post_videos(*)')
    .eq('id', postId)
    .single();
  
  if (error || !post) {
    alert('Error loading post data');
    return;
  }
  
  // Create edit modal
  const editModal = document.createElement('div');
  editModal.className = 'admin-edit-modal';
  editModal.innerHTML = `
    <div class="admin-edit-modal-content">
      <span class="admin-edit-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
      <h2>Edit Post</h2>
      
      <label>Content:</label>
      <textarea id="edit-post-content" rows="6">${sanitizeHTML(post.content || '')}</textarea>
      
      <label>Timestamp (YYYY-MM-DD HH:MM:SS):</label>
      <input type="text" id="edit-post-timestamp" value="${post.timestamp || ''}" />
      
      <label>Post Type:</label>
      <input type="text" id="edit-post-type" value="${post.type || ''}" placeholder="e.g., status, photo, video" />
      
      <div class="edit-images-section">
        <h3>Images (comma-separated URLs):</h3>
        <textarea id="edit-post-images" rows="3">${post.images ? post.images.map(img => img.url).join(',\n') : ''}</textarea>
      </div>
      
      <div class="edit-videos-section">
        <h3>Videos (comma-separated URLs):</h3>
        <textarea id="edit-post-videos" rows="3">${post.post_videos ? post.post_videos.map(vid => vid.url).join(',\n') : ''}</textarea>
      </div>
      
      <button class="admin-save-btn" onclick="savePostEdit('${postId}')">💾 Save Changes</button>
      <button class="admin-cancel-btn" onclick="this.parentElement.parentElement.remove()">❌ Cancel</button>
    </div>
  `;
  
  document.body.appendChild(editModal);
  editModal.style.display = 'flex';
}

async function savePostEdit(postId) {
  const content = document.getElementById('edit-post-content').value;
  const timestamp = document.getElementById('edit-post-timestamp').value;
  const type = document.getElementById('edit-post-type').value;
  const imagesText = document.getElementById('edit-post-images').value;
  const videosText = document.getElementById('edit-post-videos').value;
  
  try {
    // Update post
    const { error: postError } = await supabaseClient
      .from('posts')
      .update({
        content: content,
        timestamp: timestamp,
        type: type
      })
      .eq('id', postId);
    
    if (postError) throw postError;
    
    // Update images
    // First delete existing images
    await supabaseClient.from('images').delete().eq('post_id', postId);
    
    // Insert new images
    if (imagesText.trim()) {
      const imageUrls = imagesText.split(',').map(url => url.trim()).filter(url => url);
      const imageInserts = imageUrls.map(url => ({
        post_id: postId,
        url: url
      }));
      
      if (imageInserts.length > 0) {
        await supabaseClient.from('images').insert(imageInserts);
      }
    }
    
    // Update videos
    await supabaseClient.from('post_videos').delete().eq('post_id', postId);
    
    if (videosText.trim()) {
      const videoUrls = videosText.split(',').map(url => url.trim()).filter(url => url);
      const videoInserts = videoUrls.map(url => ({
        post_id: postId,
        url: url
      }));
      
      if (videoInserts.length > 0) {
        await supabaseClient.from('post_videos').insert(videoInserts);
      }
    }
    
    alert('Post updated successfully!');
    document.querySelector('.admin-edit-modal').remove();
    location.reload();
    
  } catch (err) {
    console.error('Error updating post:', err);
    alert('Failed to update post: ' + err.message);
  }
}

async function deletePost(postId) {
  if (!isAdmin) {
    alert('Only admins can delete posts');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this post? This action cannot be undone!')) {
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;
    
    alert('Post deleted successfully!');
    location.reload();
    
  } catch (err) {
    console.error('Error deleting post:', err);
    alert('Failed to delete post: ' + err.message);
  }
}

// Make functions global
window.editPost = editPost;
window.savePostEdit = savePostEdit;
window.deletePost = deletePost;

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.setAttribute('data-post-id', post.id);

    // HEADER
    const header = document.createElement('div');
    header.className = 'post-header';
    const avatar = document.createElement('img');
    avatar.src = 'profile.jpg';
    avatar.alt = 'Profile';
    avatar.className = 'post-avatar';
    avatar.onerror = function() {
        this.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect fill=%22%23ddd%22/%3E%3C/svg%3E';
    };
    const postInfo = document.createElement('div');
    postInfo.className = 'post-info';
    const authorName = document.createElement('div');
    authorName.className = 'post-author';

    // clickable profile link (Facebook-style)
    const authorLink = document.createElement('a');
    authorLink.href = 'https://facebook.com/satyapal.28';
    authorLink.target = '_blank';
    authorLink.rel = 'noopener noreferrer';
    authorLink.textContent = 'Satya Pal Singh';

    // add link inside the author div
    authorName.appendChild(authorLink);

    const postTime = document.createElement('div');
    postTime.className = 'post-time';
    postTime.textContent = post.date || post.timestamp || '';
    postInfo.appendChild(authorName);
    postInfo.appendChild(postTime);
    const postOptions = document.createElement('div');
    postOptions.className = 'post-options';
    postOptions.textContent = '⋯';
    header.appendChild(avatar);
    header.appendChild(postInfo);
    header.appendChild(postOptions);
    card.appendChild(header);

    // ADMIN CONTROLS (Edit, Delete)
    if (isAdmin) {
        const adminControls = document.createElement('div');
        adminControls.className = 'admin-post-controls';
        adminControls.innerHTML = `
            <button class="admin-edit-post-btn" onclick="editPost('${post.id}')">✏️ Edit</button>
            <button class="admin-delete-post-btn" onclick="deletePost('${post.id}')">🗑️ Delete</button>
        `;
        header.appendChild(adminControls);  
    }

    // CONTENT
    if (post.content) {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'post-content';
        let cleanedContent = cleanContent(post.content) || '';

        // 1) Trim leading/trailing whitespace/newlines
        cleanedContent = cleanedContent.replace(/^\s+|\s+$/g, '');

        // 2) Collapse multiple consecutive <br> or newlines to a single <br>
        cleanedContent = cleanedContent.replace(/(\r\n|\n|\r)/g, '<br>');
        cleanedContent = cleanedContent.replace(/(<br\s*\/?>\s*){2,}/g, '<br>');

        // 3) Remove empty paragraph tags that may come from HTML extraction
        cleanedContent = cleanedContent.replace(/<p>\s*<\/p>/gi, '');

        // 4) Make sure we don't inject a leading <br> that creates visual gap
        cleanedContent = cleanedContent.replace(/^(<br\s*\/?>)+/i, '');

        const textDiv = document.createElement('div');
        textDiv.className = 'post-text';
        textDiv.innerHTML = processHashtags(sanitizeHTML(cleanedContent));
        contentDiv.appendChild(textDiv);
        card.appendChild(contentDiv);

        // Facebook-style translation
        addTranslationFeature(card, cleanedContent);
    }

    // IMAGES (Facebook Grid Layout + Lightbox Support)
    // IMAGES (Facebook Grid Layout + Lightbox Support)
    if (post.images && post.images.length > 0) {
        const imagesDiv = document.createElement('div');
        imagesDiv.className = 'post-images';
        const imageCount = post.images.length;
    
        // Determine layout class based on image count
        if (imageCount === 1) {
            imagesDiv.classList.add('layout-1');
        } else if (imageCount === 2) {
            imagesDiv.classList.add('layout-2');
        } else if (imageCount === 3) {
            imagesDiv.classList.add('layout-3');
        } else if (imageCount === 4) {
            imagesDiv.classList.add('layout-4');
        } else {
            imagesDiv.classList.add('layout-5plus');
        }
    
        // Display max 5 images, with overlay on 5th if more exist
        const displayCount = Math.min(imageCount, 5);
    
        for (let i = 0; i < displayCount; i++) {
            const imgSrc = post.images[i];
        
            // Create container for each image
            const imgContainer = document.createElement('div');
            imgContainer.className = 'img-container';
        
            const img = document.createElement('img');
            img.src = imgSrc;
            img.classList.add('lazy');
            img.setAttribute('loading', 'lazy');
            img.alt = `Photo ${i + 1}`;
            img.loading = 'lazy';
            img.onclick = () => openImageModal(imgSrc, post.images);
            img.onerror = function() {
                this.style.display = 'none';
                this.parentElement.style.display = 'none';
            };
            imgContainer.appendChild(img);
        
            // Add overlay on 5th image if there are more than 5 images
            if (i === 4 && imageCount > 5) {
                const overlay = document.createElement('div');
                overlay.className = 'img-overlay';
                overlay.textContent = `+${imageCount - 5}`;
                overlay.onclick = () => openImageModal(imgSrc, post.images);
                imgContainer.appendChild(overlay);
            }
        imagesDiv.appendChild(imgContainer);
        }
        card.appendChild(imagesDiv);
    }

    // ============================================
    // VIDEO RENDERING - FACEBOOK-STYLE LAYOUT
    // ============================================

    // VIDEOS (same layout as images, but with iframe embeds for Google Drive)
    if (post.videos && post.videos.length > 0) {
        const videosDiv = document.createElement('div');
        videosDiv.className = 'post-images'; // Reuse same class for consistent layout
        const videoCount = post.videos.length;

        // Determine layout class based on video count (same as images)
        if (videoCount === 1) {
            videosDiv.classList.add('layout-1');
        } else if (videoCount === 2) {
            videosDiv.classList.add('layout-2');
        } else if (videoCount === 3) {
            videosDiv.classList.add('layout-3');
        } else if (videoCount === 4) {
            videosDiv.classList.add('layout-4');
        } else {
            videosDiv.classList.add('layout-5plus');
        }   

        // Display max 5 videos, with overlay on 5th if more exist
        const displayCount = Math.min(videoCount, 5);

        for (let i = 0; i < displayCount; i++) {
            const videoUrl = post.videos[i];
            
            // Create container for each video
            const videoContainer = document.createElement('div');
            videoContainer.className = 'img-container'; // Reuse img-container class
        
            // Convert Google Drive link to embeddable format
            const embedUrl = convertGoogleDriveUrl(videoUrl);
            
            if (embedUrl) {
                // Create iframe for video
                const iframe = document.createElement('iframe');
                iframe.src = embedUrl;
                iframe.classList.add('post-video-iframe');
                iframe.setAttribute('frameborder', '0');
                iframe.setAttribute('allowfullscreen', 'true');
                iframe.setAttribute('loading', 'lazy');
                iframe.alt = `Video ${i + 1}`;
            
                iframe.onerror = function() {
                    this.style.display = 'none';
                    this.parentElement.style.display = 'none';
                };
            
                videoContainer.appendChild(iframe);
            } else {
                // Fallback: create a link if conversion fails
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
        
            // Add overlay on 5th video if there are more than 5 videos
            if (i === 4 && videoCount > 5) {
                const overlay = document.createElement('div');
                overlay.className = 'img-overlay';
                overlay.textContent = `+${videoCount - 5}`;
                overlay.onclick = () => window.open(videoUrl, '_blank');
                videoContainer.appendChild(overlay);
            }
        
            videosDiv.appendChild(videoContainer);
        }
    
        card.appendChild(videosDiv);
    }

    // ============================================
    // STATS - Real counts from database
    // ============================================
    const stats = document.createElement('div');
    stats.className = 'post-stats';
    stats.setAttribute('data-post-id', post.id); // ✅ ADD THIS LINE

    const likesDiv = document.createElement('div');
    likesDiv.className = 'likes';
    likesDiv.innerHTML = '👍 <span class="like-count">0</span>';

    const commentsDiv = document.createElement('div');
    commentsDiv.className = 'comments-shares';
    commentsDiv.innerHTML = '<span class="comment-count">0</span> Comments';

    stats.appendChild(likesDiv);
    stats.appendChild(commentsDiv);
    card.appendChild(stats);

    // Load counts
    loadPostStats(post.id, likesDiv, commentsDiv);


    // ============================================
    // ACTIONS - Interactive buttons
    // ============================================
    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const likeBtn = document.createElement('button');
    likeBtn.className = 'action-btn like-btn';
    likeBtn.innerHTML = '<span class="icon">👍</span> Like';
    likeBtn.onclick = () => handleLike(post.id, likeBtn, likesDiv);

    const commentBtn = document.createElement('button');
    commentBtn.className = 'action-btn';
    commentBtn.innerHTML = '<span class="icon">💬</span> Comment';
    commentBtn.onclick = () => handleComment(post.id, commentsDiv);

    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn';
    shareBtn.innerHTML = '<span class="icon">↗️</span> Share';
    shareBtn.onclick = () => {
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied!');
    };

    actions.appendChild(likeBtn);
    actions.appendChild(commentBtn);
    actions.appendChild(shareBtn);
    card.appendChild(actions);

    // Check if user liked this post
    checkUserLiked(post.id, likeBtn);

    // LIKE COUNT (Admin only) - DEBUG VERSION
    console.log('Creating post card, isAdmin:', isAdmin, 'postId:', post.id);

    if (isAdmin) {
        console.log('Admin detected! Creating like count for post:', post.id);
        const likeCountDiv = document.createElement('div');
        likeCountDiv.className = 'admin-like-count';
        likeCountDiv.innerHTML = '👍 Loading likes...';
        likeCountDiv.setAttribute('data-post-id', post.id);
        card.appendChild(likeCountDiv);
        loadLikeCount(post.id, likeCountDiv);
    }

    // COMMENTS SECTION
    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section';
    commentsSection.style.display = 'none';
    commentsSection.setAttribute('data-post-id', post.id);

    // Comment input
    const commentInputDiv = document.createElement('div');
    commentInputDiv.className = 'comment-input-container';
    commentInputDiv.innerHTML = `
        <input type="text" class="comment-input" placeholder="Write a comment in English or Hindi..." />
        <button class="comment-submit-btn">Post</button>
    `;
    commentsSection.appendChild(commentInputDiv);

    // Comments list
    const commentsList = document.createElement('div');
    commentsList.className = 'comments-list';
    commentsSection.appendChild(commentsList);

    card.appendChild(commentsSection);

    // Comment button click - ONLY toggle section (no prompt)
    if (commentBtn) commentBtn.onclick = function() {
        const section = card.querySelector('.comments-section');
        if (section.style.display === 'none') {
            section.style.display = 'block';
            loadComments(post.id, commentsList);
        } else {
            section.style.display = 'none';
        }
    }

    // Comment submit handler
    const submitBtn = commentInputDiv.querySelector('.comment-submit-btn');
    const inputField = commentInputDiv.querySelector('.comment-input');
    submitBtn.onclick = async function() {
    const text = inputField.value.trim();
    if (!text) return;
  
    await submitComment(post.id, text, commentsList);
    inputField.value = '';
    };

    return card;
}

// Clean content
function cleanContent(content) {
    if (!content) return '';
    const stopPhrases = [
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

// Process hashtags
function processHashtags(text) {
    if (!text) return '';
    return text.replace(/#(\w+)/g, '<span style="color:#385898;font-weight:500">#$1</span>');
}

// Sidebar photo grid (optional)
function loadPhotoGrid() {
    const photoGrid = document.getElementById('photoGrid');
    if (!photoGrid) return;
    photoGrid.innerHTML = '';
    const photoPosts = allPosts
        .filter(post => post.images && post.images.length > 0)
        .sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
    photoPosts.slice(0, 9).forEach(post => {
        if (post.images && post.images.length > 0) {
            const img = document.createElement('img');
            img.src = post.images[0];
            img.classList.add('lazy');
            img.setAttribute('loading', 'lazy');
            img.alt = 'Photo';
            img.className = 'photo-grid-img';
            img.onclick = () => openImageModal(post.images[0], post.images); // Show all images in modal
            img.onerror = () => img.style.display = 'none';
            photoGrid.appendChild(img);
        }
    });
}

// Infinite scroll
function setupScrollLoading() {
    const debouncedScroll = debounce(() => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
            if (currentPage * POSTS_PER_PAGE < filteredPosts.length) {
                renderPosts();
            }
        }
    }, 150);
    
    window.addEventListener('scroll', debouncedScroll, { passive: true });
}

// Touch gesture support
function setupTouchGestures() {
    const modal = document.getElementById('imageModal');
    if (!modal) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    
    modal.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    modal.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        if (touchEndX < touchStartX - swipeThreshold) {
            navigateImage(1); // Swipe left - next
        }
        if (touchEndX > touchStartX + swipeThreshold) {
            navigateImage(-1); // Swipe right - previous
        }
    }
}

// Image modal with next/prev (improved: swipe, keyboard, accessibility, preload)
// ============================================
// IMPROVED IMAGE MODAL WITH MODERN FEATURES
// ============================================

function setupImageModal() {
    // Create modal structure
    const modal = document.createElement('div');
    modal.id = 'imageModal';
    modal.className = 'image-modal';
    
    // Modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Modal container
    const container = document.createElement('div');
    container.className = 'modal-container';
    
    // Top bar with counter and close
    const topBar = document.createElement('div');
    topBar.className = 'modal-topbar';
    
    const imageCounter = document.createElement('div');
    imageCounter.className = 'image-counter';
    imageCounter.textContent = '1 / 1';
    
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close-btn';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '✕';
    closeBtn.onclick = closeModal;
    
    topBar.appendChild(imageCounter);
    topBar.appendChild(closeBtn);
    
    // Image container with zoom support
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'modal-image-wrapper';
    
    const modalImg = document.createElement('img');
    modalImg.className = 'modal-image';
    modalImg.alt = 'Full size image';
    
    // Loading spinner
    const spinner = document.createElement('div');
    spinner.className = 'modal-spinner';
    spinner.innerHTML = '<div class="spinner-circle"></div>';
    
    imageWrapper.appendChild(spinner);
    imageWrapper.appendChild(modalImg);
    
    // Navigation buttons
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'modal-nav-btn modal-prev';
    prevBtn.setAttribute('aria-label', 'Previous image');
    prevBtn.innerHTML = '‹';
    prevBtn.onclick = (e) => {
        e.stopPropagation();
        navigateImage(-1);
    };
    
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'modal-nav-btn modal-next';
    nextBtn.setAttribute('aria-label', 'Next image');
    nextBtn.innerHTML = '›';
    nextBtn.onclick = (e) => {
        e.stopPropagation();
        navigateImage(1);
    };
    
    // Thumbnail strip at bottom
    const thumbnailStrip = document.createElement('div');
    thumbnailStrip.className = 'thumbnail-strip';
    
    // Zoom controls
    const zoomControls = document.createElement('div');
    zoomControls.className = 'zoom-controls';
    
    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'zoom-btn';
    zoomInBtn.innerHTML = '+';
    zoomInBtn.setAttribute('aria-label', 'Zoom in');
    zoomInBtn.onclick = () => zoomImage(1.2);
    
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'zoom-btn';
    zoomOutBtn.innerHTML = '−';
    zoomOutBtn.setAttribute('aria-label', 'Zoom out');
    zoomOutBtn.onclick = () => zoomImage(0.8);
    
    const zoomResetBtn = document.createElement('button');
    zoomResetBtn.className = 'zoom-btn';
    zoomResetBtn.innerHTML = '⟲';
    zoomResetBtn.setAttribute('aria-label', 'Reset zoom');
    zoomResetBtn.onclick = resetZoom;
    
    zoomControls.appendChild(zoomInBtn);
    zoomControls.appendChild(zoomOutBtn);
    zoomControls.appendChild(zoomResetBtn);
    
    // Assemble modal
    container.appendChild(topBar);
    container.appendChild(prevBtn);
    container.appendChild(imageWrapper);
    container.appendChild(nextBtn);
    container.appendChild(zoomControls);
    container.appendChild(thumbnailStrip);
    
    modal.appendChild(overlay);
    modal.appendChild(container);
    document.body.appendChild(modal);
    
    // Modal state
    let imageArray = [];
    let currentIdx = 0;
    let currentZoom = 1;
    let isDragging = false;
    let startX = 0, startY = 0;
    let translateX = 0, translateY = 0;
    
    // Image loading handler
    modalImg.onload = function() {
        spinner.style.display = 'none';
        modalImg.style.opacity = '1';
    };
    
    modalImg.onerror = function() {
        spinner.style.display = 'none';
        modalImg.style.opacity = '0.5';
    };
    
    // Update UI
    function updateUI() {
        imageCounter.textContent = `${currentIdx + 1} / ${imageArray.length}`;
        
        prevBtn.style.opacity = currentIdx === 0 ? '0.3' : '1';
        prevBtn.style.pointerEvents = currentIdx === 0 ? 'none' : 'auto';
        nextBtn.style.opacity = currentIdx === imageArray.length - 1 ? '0.3' : '1';
        nextBtn.style.pointerEvents = currentIdx === imageArray.length - 1 ? 'none' : 'auto';
        
        if (imageArray.length === 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        }
        
        updateThumbnails();
    }
    
    function navigateImage(direction) {
        const newIdx = currentIdx + direction;
        if (newIdx >= 0 && newIdx < imageArray.length) {
            currentIdx = newIdx;
            loadImage();
            resetZoom();
        }
    }
    
    function loadImage() {
        spinner.style.display = 'flex';
        modalImg.style.opacity = '0';
        modalImg.src = imageArray[currentIdx];
        updateUI();
        
        preloadImage(currentIdx - 1);
        preloadImage(currentIdx + 1);
    }
    
    function preloadImage(idx) {
        if (idx >= 0 && idx < imageArray.length) {
            const img = new Image();
            img.src = imageArray[idx];
        }
    }
    
    function updateThumbnails() {
        thumbnailStrip.innerHTML = '';
        
        if (imageArray.length <= 1 || imageArray.length > 20) {
            thumbnailStrip.style.display = 'none';
            return;
        }
        
        thumbnailStrip.style.display = 'flex';
        
        imageArray.forEach((src, idx) => {
            const thumb = document.createElement('div');
            thumb.className = 'thumbnail';
            if (idx === currentIdx) thumb.classList.add('active');
            
            const thumbImg = document.createElement('img');
            thumbImg.src = src;
            thumbImg.alt = `Thumbnail ${idx + 1}`;
            
            thumb.appendChild(thumbImg);
            thumb.onclick = () => {
                currentIdx = idx;
                loadImage();
                resetZoom();
            };
            
            thumbnailStrip.appendChild(thumb);
        });
        
        const activeThumb = thumbnailStrip.querySelector('.thumbnail.active');
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
    
    function zoomImage(factor) {
        currentZoom *= factor;
        currentZoom = Math.max(0.5, Math.min(currentZoom, 4));
        applyTransform();
    }
    
    function resetZoom() {
        currentZoom = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
    }
    
    function applyTransform() {
        modalImg.style.transform = `scale(${currentZoom}) translate(${translateX}px, ${translateY}px)`;
    }
    
    imageWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoomImage(delta);
    }, { passive: false });
    
    modalImg.addEventListener('mousedown', (e) => {
        if (currentZoom > 1) {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            modalImg.style.cursor = 'grabbing';
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            applyTransform();
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        modalImg.style.cursor = currentZoom > 1 ? 'grab' : 'default';
    });
    
    // ============================================
    // TOUCH GESTURES - COMPLETE FIXED VERSION
    // ============================================
    
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let touchMoved = false;
    let initialDistance = 0;
    let initialZoom = 1;
    let touchStartTime = 0; 

    
    // TOUCH START
    container.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now(); 
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchEndX = touchStartX;
            touchEndY = touchStartY;
            touchMoved = false;
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialDistance = Math.sqrt(dx * dx + dy * dy);
            initialZoom = currentZoom;
        }
    }, { passive: true });
    
    // TOUCH MOVE
    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            touchEndX = e.touches[0].clientX;
            touchEndY = e.touches[0].clientY;
            
            const deltaX = Math.abs(touchEndX - touchStartX);
            const deltaY = Math.abs(touchEndY - touchStartY);
            
            if (deltaX > 10 || deltaY > 10) {
                touchMoved = true;
            }
        } else if (e.touches.length === 2) {
            touchMoved = true;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const scale = distance / initialDistance;
            currentZoom = initialZoom * scale;
            currentZoom = Math.max(0.5, Math.min(currentZoom, 4));
            applyTransform();
        }
    }, { passive: true });
    
    // TOUCH END
    container.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1 && e.touches.length === 0) {
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);
            const touchDuration = Date.now() - touchStartTime;  // ← ADD THIS
            const target = e.target;  // ← ADD THIS
            const isBlackArea = target === container || target === overlay; 

            // SWIPE DOWN TO CLOSE ← ADD THIS ENTIRE BLOCK
            if (touchMoved && deltaY > 100 && absDeltaY > absDeltaX && currentZoom === 1) {
                closeModal();
                return;
            }
            
            // Check if horizontal swipe
            const isHorizontalSwipe = absDeltaX > absDeltaY && absDeltaX > 50;
            
            if (touchMoved && isHorizontalSwipe && currentZoom === 1) {
                // Horizontal swipe detected
                if (deltaX > 0) {
                    // Swipe RIGHT -> Previous image
                    navigateImage(-1);
                } else {
                    // Swipe LEFT -> Next image
                    navigateImage(1);
                }
           } 
            // TAP ON BLACK AREA TO CLOSE  ← NEW LOGIC
            else if (!touchMoved && touchDuration < 300 && isBlackArea) {
                closeModal();
            }
            // TAP ON IMAGE - TOGGLE ZOOM  ← UPDATED LOGIC
            else if (!touchMoved && touchDuration < 300 && !isBlackArea) {
                if (currentZoom === 1) {
                    currentZoom = 2;
                } else {
                    resetZoom();
                }
                applyTransform();
            }

        }
        
        // Reset
        touchMoved = false;
    }, { passive: true });

    
    function onKeyDown(e) {
        if (modal.style.display !== 'flex') return;
        
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') navigateImage(-1);
        if (e.key === 'ArrowRight') navigateImage(1);
        if (e.key === '+' || e.key === '=') zoomImage(1.2);
        if (e.key === '-' || e.key === '_') zoomImage(0.8);
        if (e.key === '0') resetZoom();
    }
    document.addEventListener('keydown', onKeyDown);
    
    function closeModal() {
        // Hide the modal overlay
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        document.body.style.overflow = 'auto';
        modalImg.src = '';

        // Only trigger history navigation
        if (window.history.state && window.history.state.modalOpen) {
            history.back();
        }
        // Restore scroll position after modal close
        if (typeof window.lastScrollY !== 'undefined') {
            setTimeout(function() {
                window.scrollTo(0, window.lastScrollY);
            }, 0);
        }
    }

    
    overlay.onclick = closeModal;
    container.onclick = (e) => e.stopPropagation();
    
    window.openImageModal = function(src, imagesList = [src]) {
        // Save current scroll position
        window.lastScrollY = window.scrollY || window.pageYOffset; // Save scroll position
        history.pushState({ modalOpen: true }, '');

        imageArray = imagesList.slice();
        currentIdx = imageArray.indexOf(src);
        if (currentIdx < 0) currentIdx = 0;
        modal.style.display = 'flex';
        history.pushState({ modalOpen: true }, '');
        document.body.classList.add('modal-open');  // ← ADD THIS LINE
        modalImg.src = imageArray[currentIdx];
        updateUI();
        preloadImage(currentIdx + 1);
        preloadImage(currentIdx - 1);
        document.body.style.overflow = 'hidden';
    };
    window.addEventListener('popstate', function(e) {
        if (window.history.state && window.history.state.modalOpen) {
            // Only close the modal, restore scroll, etc.
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            modalImg.src = '';
            setTimeout(function() {
                if (typeof window.lastScrollY !== 'undefined') {
                    window.scrollTo(0, window.lastScrollY);
                }
            }, 40);
            return; // STOP further handling
        }

        // Only below this line: do your normal navigation, rerender, reload, etc
        // For example:
        // renderPosts();   
    });


}

console.log('Facebook Complete JS Loaded');

function setupLazyLoadingWithBlur() {
  // For all images with .lazy and NOT .loaded
  document.querySelectorAll('img.lazy:not(.loaded)').forEach(img => {
    // On load, remove the blur
    img.addEventListener('load', function handler() {
      img.classList.add('loaded');
      img.removeEventListener('load', handler);
    });
    // If already loaded (from cache), mark loaded immediately
    if (img.complete) {
      img.classList.add('loaded');
    }
  });
}

// Helper function to convert Google Drive URLs to embeddable format
function convertGoogleDriveUrl(url) {
    if (!url) return null;
    
    let fileId = null;
    
    // Extract file ID from various Google Drive URL formats
    const patterns = [
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            fileId = match[1];
            break;
        }
    }
    
    if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    
    if (url.includes('/preview')) {
        return url;
    }
    
    return null;
}

// ============================================
// IMAGE MODAL/LIGHTBOX FUNCTIONS
// ============================================

function showImage(index) {
    const modalImage = document.getElementById('modalImage');
    const imageCounter = document.getElementById('imageCounter');
    
    window.currentImageIndex = index;
    modalImage.src = window.currentImages[index];
    imageCounter.textContent = `${index + 1} / ${window.currentImages.length}`;
    
    // Update active thumbnail
    document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
        if (i === index) {
            thumb.classList.add('active');
            thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            thumb.classList.remove('active');
        }
    });
    
    updateNavButtons();
}

function updateNavButtons() {
    const prevBtn = document.querySelector('.modal-prev');
    const nextBtn = document.querySelector('.modal-next');
    
    if (prevBtn && nextBtn) {
        prevBtn.style.display = window.currentImageIndex === 0 ? 'none' : 'flex';
        nextBtn.style.display = window.currentImageIndex === window.currentImages.length - 1 ? 'none' : 'flex';
    }
}

// ============================================
// IMPROVED FLEXIBLE SEARCH
// ============================================

let fuseInstance = null;

// Parse and normalize dates for better searching
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

// Clean URLs from content (don't search in URLs)
function cleanContentForSearch(content) {
    if (!content) return '';
    
    // Remove URLs
    let cleaned = content.replace(/https?:\/\/[^\s]+/g, '');
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

// Initialize search with flexible configuration
function initializeSearch() {
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
    console.log('✅ Search initialized with', allPosts.length, 'posts');
}

// Utility: Translate user query using Google Translate API
async function translateQuery(query, targetLang) {
    const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    return data[0][0][0];
}

// Main dual-language search handler
async function handleSearch(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        filteredPosts = [...allPosts];
        currentPage = 0;
        document.getElementById('postsContainer').innerHTML = '';
        renderPosts();
        updateSearchResults(allPosts.length, '');
        return;
    }

    let term = searchTerm.trim();
    const resultMap = new Map();

    // 1. Search the user's input (Hindi/English/numbers/anything)
    let results = fuseInstance.search(term);
    results.forEach(r => resultMap.set(r.item.timestamp + (r.item.content || ''), r.item));

    // 2. Search Hindi translation (as normal text)
    const hindiQuery = await translateQuery(term, 'hi');
    if (hindiQuery && hindiQuery !== term) {
        let hRes = fuseInstance.search(hindiQuery);
        hRes.forEach(r => resultMap.set(r.item.timestamp + (r.item.content || ''), r.item));
    }

    // 3. Search English translation (as normal text)
    const englishQuery = await translateQuery(term, 'en');
    if (englishQuery && englishQuery !== term && englishQuery !== hindiQuery) {
        let eRes = fuseInstance.search(englishQuery);
        eRes.forEach(r => resultMap.set(r.item.timestamp + (r.item.content || ''), r.item));
    }

    filteredPosts = Array.from(resultMap.values());
    currentPage = 0;
    document.getElementById('postsContainer').innerHTML = '';
    renderPosts();
    updateSearchResults(filteredPosts.length, searchTerm);
}


// Update UI with search results
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

// Setup search with debounce
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) {
        console.error('❌ Search input not found');
        return;
    }

    // Debounced search (300ms delay)
    const debouncedSearch = debounce((value) => {
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

// ============================================
// FACEBOOK-STYLE TRANSLATION
// ============================================

// Cache for translations (avoid re-translating)
const translationCache = {};

// Detect if text contains Hindi
function containsHindi(text) {
    return /[\u0900-\u097F]/.test(text);
}

// Translate using Google Translate API (free, no key needed)
async function translateToEnglish(text) {
    if (translationCache[text]) return translationCache[text];
    
    // ADD: Check rate limit
    if (translationRequestCount >= MAX_TRANSLATIONS_PER_MINUTE) {
        console.warn('Translation rate limit reached');
        return '⏳ Translation limit reached. Please wait...';
    }
    
    // ADD: Increment counter and reset after 1 minute
    translationRequestCount++;
    setTimeout(() => translationRequestCount--, 60000);
    
    try {
        const response = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=hi&tl=en&dt=t&q=${encodeURIComponent(text)}`);
        
        // ADD: Check if response is OK
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // ADD: Validate data structure
        if (!data || !data[0]) {
            throw new Error('Invalid translation response');
        }
        
        const translated = data[0].map(item => item[0]).join('');
        translationCache[text] = translated;
        return translated;
    } catch (error) {
        console.error('Translation error:', error);
        return '⚠️ Translation unavailable. Please try again later.';
    }
}


// Add translation UI to post
function addTranslationFeature(postElement, originalText) {
    if (!originalText || !containsHindi(originalText)) {
        return; // No Hindi text, skip
    }

    const contentDiv = postElement.querySelector('.post-content');
    
    // Create translation container
    const translationContainer = document.createElement('div');
    translationContainer.className = 'translation-container';
    
    // Create "See translation" link
    const seeTranslationLink = document.createElement('div');
    seeTranslationLink.className = 'translation-link';
    seeTranslationLink.innerHTML = '⚙️ See translation';
    seeTranslationLink.style.display = 'block';
    
    // Create translated text div (hidden initially)
    const translatedDiv = document.createElement('div');
    translatedDiv.className = 'translated-text';
    translatedDiv.style.display = 'none';
    
    // Create "Hide original" link
    const hideOriginalLink = document.createElement('div');
    hideOriginalLink.className = 'translation-link';
    hideOriginalLink.innerHTML = '⚙️ Hide original · Rate this translation';
    hideOriginalLink.style.display = 'none';
    
    // Click handler for "See translation"
    seeTranslationLink.onclick = async function() {
        seeTranslationLink.innerHTML = '⚙️ Translating...';
        
        const translation = await translateToEnglish(originalText);
        
        if (translation) {
            translatedDiv.innerHTML = sanitizeHTML(translation).replace(/\n/g, '<br>');
            translatedDiv.style.display = 'block';
            seeTranslationLink.style.display = 'none';
            hideOriginalLink.style.display = 'block';
        } else {
            seeTranslationLink.innerHTML = '⚙️ Translation failed';
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

// ============================================
// ADMIN LOGIN SYSTEM (Supabase Auth)
// ============================================
let isAdmin = false;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is already logged in
    const { data: { session } } = await supabaseClient.auth.getSession();
  
    if (session) {
        currentUser = session.user;
        await checkAdminStatus();
    }
  
    // Admin login button
    const adminBtn = document.getElementById('adminLoginBtn');
    const adminModal = document.getElementById('adminLoginModal');
    const adminClose = document.querySelector('.admin-close');
    const adminSubmit = document.getElementById('adminLoginSubmit');
  
    if (adminBtn) {
        adminBtn.onclick = function() {
        if (isAdmin) {
            logoutAdmin();
        } else {
            adminModal.style.display = 'flex';
        }
        };
    }
  
    if (adminClose) {
        adminClose.onclick = function() {
        adminModal.style.display = 'none';
        };
    }
  
    if (adminSubmit) {
        adminSubmit.onclick = async function() {
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const errorDiv = document.getElementById('adminLoginError');
      
        if (!email || !password) {
            errorDiv.textContent = 'Please enter both email and password';
            return;
        }
      
        // Show loading
        adminSubmit.disabled = true;
        adminSubmit.textContent = 'Logging in...';
        errorDiv.textContent = '';
      
        try {
            // Sign in with Supabase Auth
            const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
            });
        
            if (error) {
            errorDiv.textContent = 'Invalid email or password';
            adminSubmit.disabled = false;
            adminSubmit.textContent = 'Login';
            return;
            }   
        
            currentUser = data.user;
        
            // Check if user is admin
            const isAdminUser = await checkAdminStatus();
        
            if (!isAdminUser) {
                // User logged in but is not admin
                await supabaseClient.auth.signOut();
                errorDiv.textContent = 'You do not have admin privileges';
                adminSubmit.disabled = false;
                adminSubmit.textContent = 'Login';
                return;
            }
        
            // Success
            adminModal.style.display = 'none';
            errorDiv.textContent = '';
            alert(`Welcome Admin! (${email})`);
            location.reload();
        
        } catch (err) {
            console.error('Login error:', err);
            errorDiv.textContent = 'Login failed. Please try again.';
            adminSubmit.disabled = false;
            adminSubmit.textContent = 'Login';
        }
        };
    }
});

// Check if current user is admin
async function checkAdminStatus() {
    if (!currentUser) {
        isAdmin = false;
        return false;
    }
  
    try {
        const { data, error } = await supabaseClient
        .from('admin_roles')
        .select('user_id')
        .eq('user_id', currentUser.id)
        .single();
    
    if (data && !error) {
        isAdmin = true;
        localStorage.setItem('fb_admin', 'true');
        localStorage.setItem('fb_admin_email', currentUser.email);
        enableAdminFeatures();
        return true;
    } else {
        isAdmin = false;
        localStorage.removeItem('fb_admin');
        return false;
    }
    } catch (err) {
        console.error('Admin check error:', err);
        isAdmin = false;
        return false;
    }
}

function enableAdminFeatures() {
    // Change admin button to logout
    const adminBtn = document.getElementById('adminLoginBtn');
    if (adminBtn) {
        adminBtn.title = 'Admin Logout';
        adminBtn.style.backgroundColor = '#42b72a';
    }
  
    // Show admin add post button
    const addPostBtn = document.getElementById('adminAddPostBtn');
    if (addPostBtn) {
        addPostBtn.style.display = 'flex';
        addPostBtn.onclick = showAddPostModal;
    }
  
    // Show like counts (already implemented in createPostCard)
    document.body.classList.add('admin-mode');

    // DEBUG: Log admin status
    console.log('✅ ADMIN MODE ENABLED');
    console.log('isAdmin:', isAdmin);
    console.log('currentUser:', currentUser);
}

function showAddPostModal() {
    const addModal = document.createElement('div');
    addModal.className = 'admin-edit-modal';
    addModal.innerHTML = `
        <div class="admin-edit-modal-content">
        <span class="admin-edit-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
        <h2>Create New Post</h2>
      
        <label>Content:</label>
        <textarea id="new-post-content" rows="6" placeholder="What's on your mind?"></textarea>
      
        <label>Timestamp (YYYY-MM-DD HH:MM:SS):</label>
        <input type="text" id="new-post-timestamp" value="${new Date().toISOString().slice(0, 19).replace('T', ' ')}" />
      
        <label>Post Type:</label>
        <input type="text" id="new-post-type" value="status" placeholder="e.g., status, photo, video" />
      
        <div class="edit-images-section">
            <h3>Images (comma-separated URLs):</h3>
            <textarea id="new-post-images" rows="3" placeholder="https://example.com/image1.jpg,&#10;https://example.com/image2.jpg"></textarea>
        </div>
      
        <div class="edit-videos-section">
            <h3>Videos (comma-separated URLs):</h3>
            <textarea id="new-post-videos" rows="3" placeholder="https://drive.google.com/file/d/xxx/view"></textarea>
        </div>
      
        <button class="admin-save-btn" onclick="saveNewPost()">📝 Create Post</button>
        <button class="admin-cancel-btn" onclick="this.parentElement.parentElement.remove()">❌ Cancel</button>
        </div>
    `;
  
    document.body.appendChild(addModal);
    addModal.style.display = 'flex';
}

async function saveNewPost() {
    const content = document.getElementById('new-post-content').value;
    const timestamp = document.getElementById('new-post-timestamp').value;
    const type = document.getElementById('new-post-type').value;
    const imagesText = document.getElementById('new-post-images').value;
    const videosText = document.getElementById('new-post-videos').value;
  
    if (!content.trim()) {
        alert('Please enter post content');
        return;
    }
  
    try {
        // Insert post
        const { data: newPost, error: postError } = await supabaseClient
        .from('posts')
        .insert([{
            content: content,
            timestamp: timestamp,
            type: type,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();
    
        if (postError) throw postError;
    
        const postId = newPost.id;
    
        // Insert images
        if (imagesText.trim()) {
            const imageUrls = imagesText.split(',').map(url => url.trim()).filter(url => url);
            const imageInserts = imageUrls.map(url => ({
            post_id: postId,
            url: url
        }));
      
            if (imageInserts.length > 0) {
                await supabaseClient.from('images').insert(imageInserts);
            }
        }
    
        // Insert videos
        if (videosText.trim()) {
            const videoUrls = videosText.split(',').map(url => url.trim()).filter(url => url);
            const videoInserts = videoUrls.map(url => ({
            post_id: postId,
            url: url
        }));
      
            if (videoInserts.length > 0) {
                await supabaseClient.from('post_videos').insert(videoInserts);
            }
        }
    
        alert('Post created successfully!');
        document.querySelector('.admin-edit-modal').remove();
        location.reload();
    
    } catch (err) {
        console.error('Error creating post:', err);
        alert('Failed to create post: ' + err.message);
    }
}

window.showAddPostModal = showAddPostModal;
window.saveNewPost = saveNewPost;

async function logoutAdmin() {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('fb_admin');
    localStorage.removeItem('fb_admin_email');
    isAdmin = false;
    currentUser = null;
    alert('Logged out successfully');
    location.reload();
}


// ==================== LIKE/COMMENT HANDLERS ====================

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
        console.error('Stats error:', err);
    }
}

async function checkUserLiked(postId, likeBtn) {
    try {
        const { data } = await supabaseClient
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', getUserId())
            .maybeSingle();
        
        if (data) {
            likeBtn.classList.add('liked');
            likeBtn.style.color = '#1877f2';
            likeBtn.innerHTML = '<span class="icon">👍</span> Liked';
        }
    } catch (err) {}
}

// ==================== IMPROVED LIKE HANDLER WITH DEBOUNCING ====================
// Track posts currently being liked (prevent spam clicking)
let likeInProgress = new Set();

async function handleLike(postId, likeBtn, likesDiv) {
    if (likeInProgress.has(postId)) {
        console.log('⏳ Like in progress...');
        return;
    }
    
    likeInProgress.add(postId);
    likeBtn.disabled = true;
    
    try {
        const userId = getUserId();
        const { data: existing } = await supabaseClient
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .maybeSingle();
        
        if (existing) {
            await supabaseClient.from('likes').delete().eq('id', existing.id);
            likeBtn.classList.remove('liked');
            likeBtn.style.color = '';
            likeBtn.innerHTML = '<span class="icon">👍</span> Like';
        } else {
            const { error } = await supabaseClient.from('likes').insert({
                post_id: postId,
                user_id: userId,
                username: getUsername()
            });
            
            if (!error || error.code === '23505') {
                likeBtn.classList.add('liked');
                likeBtn.style.color = '#1877f2';
                likeBtn.innerHTML = '<span class="icon">👍</span> Liked';
                logUserActivity('like', postId);
            }
        }
        
        // ✅ ALWAYS UPDATE COUNT FROM DATABASE
        const { count } = await supabaseClient
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);
        
        console.log('Like count for post:', postId, '=', count);
        
        const countSpan = likesDiv.querySelector('.like-count');
        if (countSpan) {
            countSpan.textContent = count || 0;
            console.log('Updated like count display to:', count);
        } else {
            console.error('Could not find .like-count span!');
        }

        // ✅ ALSO UPDATE THE BLUE BOX
        const blueBox = document.querySelector(`.admin-like-count[data-post-id="${postId}"]`);
        if (blueBox) {
            await loadLikeCount(postId, blueBox);
        }
        
    } catch (err) {
        console.error('Like error:', err);
    } finally {
        likeBtn.disabled = false;
        likeInProgress.delete(postId);
    }
}


async function handleComment(postId, commentsDiv) {
    const message = prompt('Write your comment:');
    if (!message || !message.trim()) return;
    
    try {
        const { error } = await supabaseClient.from('comments').insert({
            post_id: postId,
            username: getUsername(),
            message: sanitizeHTML(message.trim())
        });
        
        if (error) throw error;
        
        console.log('✅ Comment posted successfully');
        
        // ✅ UPDATE COMMENT COUNT
        const { count } = await supabaseClient
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);
        
        console.log('📊 Comment count for post:', postId, '=', count);
        
        const commentSpan = commentsDiv.querySelector('.comment-count');
        if (commentSpan) {
            commentSpan.textContent = count || 0;
            console.log('✅ Updated comment count display to:', count);
        } else {
            console.error('❌ Could not find .comment-count span!');
        }
        
        alert('✅ Comment posted!');
        logUserActivity('comment', postId);
        
    } catch (err) {
        console.error('❌ Comment error:', err);
        alert('Error posting comment.');
    }
}

// ==========================================
// MOBILE HAMBURGER MENU SETUP
// ==========================================

// ==========================================
// MOBILE HAMBURGER MENU SETUP
// ==========================================

function setupMobileMenu() {
    console.log('🍔 Setting up mobile menu...'); // Debug log
    
    const menuBtn = document.getElementById('mobileMenuBtn');
    const dropdown = document.getElementById('mobileDropdown');
    
    console.log('Hamburger button:', menuBtn); // Debug log
    console.log('Dropdown menu:', dropdown); // Debug log
    
    if (!menuBtn || !dropdown) {
        console.error('❌ Hamburger menu elements not found!');
        return;
    }
    
    console.log('✅ Elements found, attaching listeners...');
    
    // Toggle menu
    menuBtn.addEventListener('click', function(e) {
        console.log('🔄 Hamburger clicked!');
        e.stopPropagation();
        menuBtn.classList.toggle('active');
        dropdown.classList.toggle('active');
    });
    
    // Close when clicking outside
    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target) && !menuBtn.contains(e.target)) {
            menuBtn.classList.remove('active');
            dropdown.classList.remove('active');
        }
    });
    
    // Close when clicking menu item
    dropdown.querySelectorAll('.mobile-menu-item').forEach(item => {
        item.addEventListener('click', function() {
            console.log('Menu item clicked');
            menuBtn.classList.remove('active');
            dropdown.classList.remove('active');
        });
    });
    
    // Connect mobile buttons to desktop buttons
    const notificationBtnMobile = document.getElementById('notificationBtnMobile');
    const notificationBtnDesktop = document.getElementById('notificationBtn');
    if (notificationBtnMobile && notificationBtnDesktop) {
        notificationBtnMobile.onclick = function() {
            notificationBtnDesktop.click();
        };
    }
    
    const adminLoginBtnMobile = document.getElementById('adminLoginBtnMobile');
    const adminLoginBtnDesktop = document.getElementById('adminLoginBtn');
    if (adminLoginBtnMobile && adminLoginBtnDesktop) {
        adminLoginBtnMobile.onclick = function() {
            adminLoginBtnDesktop.click();
        };
    }
    
    const adminAddPostBtnMobile = document.getElementById('adminAddPostBtnMobile');
    const adminAddPostBtnDesktop = document.getElementById('adminAddPostBtn');
    if (adminAddPostBtnMobile && adminAddPostBtnDesktop) {
        adminAddPostBtnMobile.onclick = function() {
            adminAddPostBtnDesktop.click();
        };
        
        // Sync visibility
        syncAddPostButtonVisibility();
    }
    
    console.log('✅ Mobile menu setup complete!');
}

// Sync Add Post button visibility
function syncAddPostButtonVisibility() {
    const adminAddPostBtnDesktop = document.getElementById('adminAddPostBtn');
    const adminAddPostBtnMobile = document.getElementById('adminAddPostBtnMobile');
    
    if (!adminAddPostBtnDesktop || !adminAddPostBtnMobile) return;
    
    // Create observer
    const observer = new MutationObserver(function() {
        const desktopVisible = adminAddPostBtnDesktop.style.display !== 'none';
        adminAddPostBtnMobile.style.display = desktopVisible ? 'flex' : 'none';
    });
    
    observer.observe(adminAddPostBtnDesktop, {
        attributes: true,
        attributeFilter: ['style']
    });
    
    // Initial sync
    const desktopVisible = adminAddPostBtnDesktop.style.display !== 'none';
    adminAddPostBtnMobile.style.display = desktopVisible ? 'flex' : 'none';
}

// ✅ IMPORTANT: Call this AFTER everything else loads
// Add a small delay to ensure DOM is ready
setTimeout(function() {
    setupMobileMenu();
}, 500);




