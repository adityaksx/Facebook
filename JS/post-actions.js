// ============================================
// POST ACTIONS - LIKE & COMMENT
// ============================================

/**
 * Handle like/unlike action on a post
 * Prevents spam clicking with debouncing
 * @param {string} postId - The post ID
 * @param {HTMLElement} likeBtn - The like button element
 * @param {HTMLElement} likesDiv - Element showing like count
 */
async function handleLike(postId, likeBtn, likesDiv) {
    if (likeInProgress.has(postId)) {
        console.log('⏳ Like in progress...');
        return;
    }
    
    likeInProgress.add(postId);
    likeBtn.disabled = true;
    
    try {
        const userId = SupabaseClient.getUserId();
        
        // Check if user already liked
        const { data: existing } = await supabaseClient
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .maybeSingle();
        
        if (existing) {
            // Unlike
            await supabaseClient.from('likes').delete().eq('id', existing.id);
            likeBtn.classList.remove('liked');
            likeBtn.style.color = '';
            likeBtn.innerHTML = '<span class="icon">👍</span> Like';
        } else {
            // Like
            const { error } = await supabaseClient.from('likes').insert({
                post_id: postId,
                user_id: userId,
                username: SupabaseClient.getUsername()
            });
            
            if (!error || error.code === '23505') { // 23505 = duplicate key (race condition)
                likeBtn.classList.add('liked');
                likeBtn.style.color = '#1877f2';
                likeBtn.innerHTML = '<span class="icon">👍</span> Liked';
                SupabaseClient.logUserActivity('like', postId);
            }
        }
        
        // Update like count from database
        const { count } = await supabaseClient
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);
        
        const countSpan = likesDiv.querySelector('.like-count');
        if (countSpan) {
            countSpan.textContent = count || 0;
            console.log(`✅ Updated like count to: ${count}`);
        }

        // Update admin blue box if exists
        const blueBox = document.querySelector(`.admin-like-count[data-post-id="${postId}"]`);
        if (blueBox) {
            await DataLoader.loadLikeCount(postId, blueBox);
        }
        
    } catch (err) {
        console.error('❌ Like error:', err);
        Toastify({
            text: "❌ Failed to like post",
            duration: 2000,
            gravity: "top",
            position: "right",
            style: { background: "#ff4444" }
        }).showToast();
    } finally {
        likeBtn.disabled = false;
        likeInProgress.delete(postId);
    }
}

/**
 * Handle comment action (legacy prompt-based)
 * @param {string} postId - The post ID
 * @param {HTMLElement} commentsDiv - Element showing comment count
 */
async function handleComment(postId, commentsDiv) {
    const message = prompt('Write your comment:');
    if (!message || !message.trim()) return;
    
    // Validate input length
    if (!Security.validateInputLength(message, 1000)) {
        alert('Comment too long! Maximum 1000 characters.');
        return;
    }
    
    try {
        const { error } = await supabaseClient.from('comments').insert({
            post_id: postId,
            username: SupabaseClient.getUsername(),
            message: Security.sanitizeHTML(message.trim())
        });
        
        if (error) throw error;
        
        // Update comment count
        const { count } = await supabaseClient
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);
        
        const commentSpan = commentsDiv.querySelector('.comment-count');
        if (commentSpan) {
            commentSpan.textContent = count || 0;
        }
        
        Toastify({
            text: "✅ Comment posted!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();
        
        SupabaseClient.logUserActivity('comment', postId);
        
    } catch (err) {
        console.error('❌ Comment error:', err);
        Toastify({
            text: "❌ Error posting comment",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#ff4444" }
        }).showToast();
    }
}

/**
 * Submit comment from input field
 * @param {string} postId - The post ID
 * @param {string} message - Comment text
 * @param {HTMLElement} containerElement - Comments container
 */
async function submitComment(postId, message, containerElement) {
    const userId = SupabaseClient.getUserId();
    const username = SupabaseClient.getUsername();
    
    // Validate input
    if (!Security.validateInputLength(message, 1000)) {
        Toastify({
            text: "⚠️ Comment too long (max 1000 characters)",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#ff9800" }
        }).showToast();
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('comments')
            .insert([{
                post_id: postId,
                username: username,
                message: Security.sanitizeHTML(message),
                created_at: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('❌ Error inserting comment:', error);
            Toastify({
                text: "❌ Could not post comment. Please try again.",
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: "#ff4444" }
            }).showToast();
            return;
        }
        
        console.log('✅ Comment posted successfully');
        SupabaseClient.logUserActivity('COMMENT', postId);
        
        // Update comment count
        const { count } = await supabaseClient
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);
        
        const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (postCard) {
            const commentSpan = postCard.querySelector('.comment-count');
            if (commentSpan) {
                commentSpan.textContent = count || 0;
            }
        }
        
        // Reload comments list
        DataLoader.loadComments(postId, containerElement);
        
    } catch (err) {
        console.error('❌ Comment error:', err);
    }
}

/**
 * Check if current user has liked a post
 * @param {string} postId - The post ID
 * @param {HTMLElement} likeBtn - The like button element
 */
async function checkUserLiked(postId, likeBtn) {
    try {
        const { data } = await supabaseClient
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', SupabaseClient.getUserId())
            .maybeSingle();
        
        if (data) {
            likeBtn.classList.add('liked');
            likeBtn.style.color = '#1877f2';
            likeBtn.innerHTML = '<span class="icon">👍</span> Liked';
        }
    } catch (err) {
        console.error('❌ Check liked error:', err);
    }
}

/**
 * Delete a comment (admin only)
 * @param {string} commentId - The comment ID
 * @param {string} postId - The post ID
 */
async function deleteComment(commentId, postId) {
    if (!isAdmin) {
        Toastify({
            text: "⚠️ Only admins can delete comments",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#ff9800" }
        }).showToast();
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
        
        if (error) throw error;
        
        Toastify({
            text: "✅ Comment deleted successfully",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();
        
        // Reload comments
        const commentsList = document.querySelector(`[data-post-id="${postId}"] .comments-list`);
        if (commentsList) {
            DataLoader.loadComments(postId, commentsList);
        }
    } catch (err) {
        console.error('❌ Delete comment error:', err);
        Toastify({
            text: "❌ Failed to delete comment",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#ff4444" }
        }).showToast();
    }
}

console.log('✅ Post actions loaded');

// Make function global for onclick handlers
window.deleteComment = deleteComment;

// Export for other modules
window.PostActions = {
    handleLike,
    handleComment,
    submitComment,
    checkUserLiked,
    deleteComment
};
