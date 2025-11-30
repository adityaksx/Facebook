// ============================================
// ADMIN POST MANAGEMENT
// ============================================

/**
 * Upload image file to Supabase Storage
 * @param {File} file - Image file to upload
 * @returns {Promise<string>} - Public URL of uploaded image
 */
async function uploadImageToSupabase(file) {
    try {
        // Sanitize filename
        const sanitizedName = Security.sanitizeFilename(file.name);
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${sanitizedName}`;
        const filePath = `posts/${fileName}`;

        console.log('📤 Uploading to Supabase Storage:', fileName);

        // Upload to Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('post-images')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('❌ Supabase upload error:', error);
            if (window.posthog) {
                posthog.captureException(err, {
                    func: 'loadImageToSupabase',
                    postId
                });
            }
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from('post-images')
            .getPublicUrl(filePath);

        console.log('✅ Uploaded to Supabase:', publicUrl);
        return publicUrl;

    } catch (error) {
        console.error('❌ Upload error:', error);
        if (window.posthog) {
            posthog.captureException(err, {
                func: 'uploadImageToSupabase',
                postId
            });
        }
        throw error;
    }
}

/**
 * Edit existing post (admin only)
 * @param {string} postId - The post ID to edit
 */
async function editPost(postId) {
    if (!isAdmin) {
        Toastify({
            text: "⚠️ Only admins can edit posts",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#ff9800" }
        }).showToast();
        return;
    }
    
    // Fetch current post data
    const { data: post, error } = await supabaseClient
        .from('posts')
        .select('*, images(*), post_videos(*)')
        .eq('id', postId)
        .single();
    
    if (error || !post) {
        Toastify({
            text: "❌ Error loading post data",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#ff4444" }
        }).showToast();
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
            <textarea id="edit-post-content" rows="6">${Security.sanitizeHTML(post.content || '')}</textarea>
            
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

/**
 * Save edited post to database
 * @param {string} postId - The post ID to save
 */
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
        await supabaseClient.from('images').delete().eq('post_id', postId);
        
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
        
        Toastify({
            text: "✅ Post updated successfully!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();
        
        document.querySelector('.admin-edit-modal').remove();
        location.reload();
        
    } catch (err) {
        console.error('❌ Error updating post:', err);
        if (window.posthog) {
            posthog.captureException(err, {
                func: 'savePostEdit',
                postId
            });
        }
        Toastify({
            text: "❌ Failed to update post: " + err.message,
            duration: 4000,
            gravity: "top",
            position: "right",
            style: { background: "#ff4444" }
        }).showToast();
    }
}

/**
 * Delete a post (admin only)
 * @param {string} postId - The post ID to delete
 */
async function deletePost(postId) {
    if (!isAdmin) {
        Toastify({
            text: "⚠️ Only admins can delete posts",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#ff9800" }
        }).showToast();
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
        
        Toastify({
            text: "✅ Post deleted successfully!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();
        
        location.reload();
        
    } catch (err) {
        console.error('❌ Error deleting post:', err);
        if (window.posthog) {
            posthog.captureException(err, {
                func: 'deletePost',
                postId
            });
        }
        Toastify({
            text: "❌ Failed to delete post: " + err.message,
            duration: 4000,
            gravity: "top",
            position: "right",
            style: { background: "#ff4444" }
        }).showToast();
    }
}

/**
 * Create and save a new post with image uploads
 */
async function saveNewPost() {
    const content = document.getElementById('new-post-content').value;
    const timestamp = document.getElementById('new-post-timestamp').value;
    const type = document.getElementById('new-post-type').value;
    const videosText = document.getElementById('new-post-videos').value;
    const imageFiles = document.getElementById('new-post-image-files').files;

    if (!content.trim()) {
        Toastify({
            text: "⚠️ Please enter post content",
            duration: 3000,
            gravity: "top",
            position: "center",
            style: { background: "#ff9800" }
        }).showToast();
        return;
    }

    // Show loading
    const saveBtn = document.querySelector('.admin-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Uploading images...';

    try {
        // 1. Upload images to Supabase Storage
        const uploadedImageUrls = [];
        
        if (imageFiles.length > 0) {
            for (let i = 0; i < imageFiles.length; i++) {
                saveBtn.textContent = `⏳ Uploading ${i + 1}/${imageFiles.length}...`;
                const url = await uploadImageToSupabase(imageFiles[i]);
                uploadedImageUrls.push(url);
            }
        }

        console.log('✅ All images uploaded:', uploadedImageUrls);

        // 2. Create post in database
        saveBtn.textContent = '⏳ Saving post...';
        
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

        // 3. Insert image URLs into database
        if (uploadedImageUrls.length > 0) {
            const imageInserts = uploadedImageUrls.map(url => ({
                post_id: postId,
                url: url
            }));

            const { error: imageError } = await supabaseClient
                .from('images')
                .insert(imageInserts);

            if (imageError) throw imageError;
        }

        // 4. Insert videos
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

        Toastify({
            text: "✅ Post created successfully!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();

        document.querySelector('.admin-edit-modal').remove();
        location.reload();

    } catch (err) {
        console.error('❌ Error creating post:', err);
        if (window.posthog) {
            posthog.captureException(err, {
                func: 'saveNewPost',
                postId
            });
        }
        Toastify({
            text: `❌ Failed: ${err.message}`,
            duration: 4000,
            gravity: "top",
            position: "right",
            style: { background: "#ff4444" }
        }).showToast();
        
        saveBtn.disabled = false;
        saveBtn.textContent = 'Create Post';
    }
}

/**
 * Show modal to create a new post
 */
function showAddPostModal() {
    const addModal = document.createElement('div');
    addModal.className = 'admin-edit-modal';
    addModal.innerHTML = `
        <div class="admin-edit-modal-content">
            <span class="admin-edit-close" onclick="this.parentElement.parentElement.remove()">×</span>
            <h2>Create New Post</h2>
            
            <label>Content</label>
            <textarea id="new-post-content" rows="6" placeholder="What's on your mind?"></textarea>
            
            <label>Timestamp (YYYY-MM-DD HH:MM:SS)</label>
            <input type="text" id="new-post-timestamp" value="${new Date().toISOString().slice(0, 19).replace('T', ' ')}">
            
            <label>Post Type</label>
            <input type="text" id="new-post-type" value="status" placeholder="e.g., status, photo, video">
            
            <div class="edit-images-section">
                <h3>📸 Upload Images</h3>
                <input type="file" id="new-post-image-files" multiple accept="image/*" style="margin-bottom: 10px;">
                <div id="image-preview" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;"></div>
            </div>
            
            <div class="edit-videos-section">
                <h3>Videos (comma-separated URLs)</h3>
                <textarea id="new-post-videos" rows="3" placeholder="https://drive.google.com/file/d/xxx/view"></textarea>
            </div>
            
            <button class="admin-save-btn" onclick="saveNewPost()">Create Post</button>
            <button class="admin-cancel-btn" onclick="this.parentElement.parentElement.remove()">Cancel</button>
        </div>
    `;
    
    document.body.appendChild(addModal);
    addModal.style.display = 'flex';

    // Image preview handler
    const fileInput = document.getElementById('new-post-image-files');
    const previewDiv = document.getElementById('image-preview');
    
    fileInput.addEventListener('change', (e) => {
        previewDiv.innerHTML = '';
        const files = Array.from(e.target.files);
        
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.width = '100px';
                img.style.height = '100px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '8px';
                img.style.border = '2px solid #1877f2';
                previewDiv.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}

/**
 * Sync Add Post button visibility between desktop and mobile
 */
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

console.log('✅ Admin actions loaded');

// Make functions global for onclick handlers
window.editPost = editPost;
window.savePostEdit = savePostEdit;
window.deletePost = deletePost;
window.saveNewPost = saveNewPost;
window.showAddPostModal = showAddPostModal;

// Export for other modules
window.AdminActions = {
    uploadImageToSupabase,
    editPost,
    savePostEdit,
    deletePost,
    saveNewPost,
    showAddPostModal,
    syncAddPostButtonVisibility
};
