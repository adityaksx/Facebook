/**
 * Initialize PhotoSwipe lightbox with thumbnails and admin edit button
 */
/**
 * Initialize PhotoSwipe lightbox with thumbnails and admin edit button
 */
function initPhotoSwipe() {
    console.log('🔍 PhotoSwipe check:', typeof PhotoSwipeLightbox, typeof PhotoSwipe);
    
    if (typeof PhotoSwipeLightbox === 'undefined' || typeof PhotoSwipe === 'undefined') {
        console.error('❌ PhotoSwipe libraries not loaded!');
        return;
    }

    const lightbox = new PhotoSwipeLightbox({
        // ✅ FIX: Use data attribute selector to group by post
        gallerySelector: '[data-pswp-gallery]',
        childSelector: 'a',
        pswpModule: PhotoSwipe,
        padding: { top: 50, bottom: 130, left: 20, right: 20 },
        bgOpacity: 0.95,
        loop: true
    });

    // Add custom edit button (admin only)
    lightbox.on('uiRegister', function() {
        if (!isAdmin) return;
        
        lightbox.pswp.ui.registerElement({
            name: 'edit-button',
            order: 9,
            isButton: true,
            html: '✏️ Edit',
            onClick: (event, el) => {
                const currentSlide = lightbox.pswp.currSlide;
                const imageSrc = currentSlide.data.src;
                
                const linkElement = currentSlide.data.element;
                const postCard = linkElement.closest('[data-post-id]');
                const postId = postCard ? postCard.getAttribute('data-post-id') : null;
                
                const allImagesInPost = postCard.querySelectorAll('a[data-pswp-src]');
                let imageIndex = 0;
                allImagesInPost.forEach((img, idx) => {
                    if (img.getAttribute('data-pswp-src') === imageSrc) {
                        imageIndex = idx;
                    }
                });
                
                currentEditingPostId = postId;
                currentEditingImageIndex = imageIndex;
                
                lightbox.pswp.close();
                
                setTimeout(() => {
                    openTuiEditor(imageSrc, postId, imageIndex);
                }, 300);
            }
        });
    });

    // Create thumbnails when PhotoSwipe opens
    lightbox.on('afterInit', () => {
        const pswpElement = lightbox.pswp.element;
        if (!pswpElement) return;

        // Remove existing thumbnails
        const existingThumbs = pswpElement.querySelector('.pswp__thumbnails');
        if (existingThumbs) existingThumbs.remove();

        // Create thumbnail container
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'pswp__thumbnails';

        const numItems = lightbox.pswp.getNumItems();
        console.log(`✅ Creating ${numItems} thumbnails`);
        
        // Create thumbnail for each slide
        for (let i = 0; i < numItems; i++) {
            const slideData = lightbox.pswp.getItemData(i);
            if (!slideData || !slideData.src) continue;
            
            const thumb = document.createElement('img');
            thumb.src = slideData.msrc || slideData.src;
            thumb.className = 'pswp__thumbnail';
            thumb.dataset.index = i;
            
            if (i === lightbox.pswp.currIndex) {
                thumb.classList.add('active');
            }

            thumb.onclick = () => lightbox.pswp.goTo(i);
            thumbContainer.appendChild(thumb);
        }

        pswpElement.appendChild(thumbContainer);
        
        // Scroll to active thumbnail
        setTimeout(() => {
            const activeThumb = thumbContainer.querySelector('.pswp__thumbnail.active');
            if (activeThumb) {
                activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 100);
    });

    // Update active thumbnail when sliding
    lightbox.on('change', () => {
        const thumbs = document.querySelectorAll('.pswp__thumbnail');
        const currentIndex = lightbox.pswp.currIndex;
        
        thumbs.forEach((thumb, i) => {
            if (i === currentIndex) {
                thumb.classList.add('active');
                thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                thumb.classList.remove('active');
            }
        });
    });

    lightbox.init();
    console.log('✅ PhotoSwipe lightbox initialized');
}


/**
 * Initialize TUI Image Editor
 */
function initTuiEditor() {
    if (tuiImageEditor) return;

    if (typeof tui === 'undefined' || typeof tui.ImageEditor === 'undefined') {
        console.error('❌ Tui ImageEditor not loaded!');
        return;
    }

    if (typeof fabric === 'undefined') {
        console.error('❌ Fabric.js not loaded!');
        return;
    }

    tuiImageEditor = new tui.ImageEditor('#tuiImageEditorContainer', {
        includeUI: {
            loadImage: {
                path: '',
                name: 'Image'
            },
            theme: {
                'common.bi.image': '',
                'common.bisize.width': '0px',
                'common.bisize.height': '0px',
                'common.backgroundImage': 'none',
                'common.backgroundColor': '#1e1e1e',
                'common.border': '0px'
            },
            menu: ['crop', 'flip', 'rotate', 'draw', 'shape', 'icon', 'text', 'filter'],
            initMenu: '',
            uiSize: {
                width: '100%',
                height: '100%'
            },
            menuBarPosition: 'bottom'
        },
        cssMaxWidth: 1400,
        cssMaxHeight: 900,
        usageStatistics: false
    });

    console.log('✅ Tui Image Editor initialized');
}

/**
 * Open TUI editor with image (admin only)
 * @param {string} imageSrc - Image URL to edit
 * @param {string} postId - Post ID
 * @param {number} imageIndex - Image index in post
 */
function openTuiEditor(imageSrc, postId, imageIndex) {
    if (!isAdmin) {
        Toastify({
            text: "⚠️ Only admins can edit images",
            duration: 3000,
            gravity: "top",
            position: "center",
            style: { background: "#ff9800" }
        }).showToast();
        return;
    }

    currentEditingImageSrc = imageSrc;
    currentEditingPostId = postId;
    currentEditingImageIndex = imageIndex;
    
    if (!tuiImageEditor) {
        initTuiEditor();
    }

    if (!tuiImageEditor) {
        alert('Editor failed to initialize. Check console for errors.');
        return;
    }

    document.getElementById('tuiEditorModal').style.display = 'flex';

    tuiImageEditor.loadImageFromURL(imageSrc, 'EditImage')
        .then(() => {
            console.log('✅ Image loaded in editor');
            setTimeout(() => {
                tuiImageEditor.ui.activeMenuEvent();
                tuiImageEditor.ui.changeMenu('filter');
                console.log('✅ Editor tools activated');
            }, 500);
        })
        .catch(err => {
            console.error('❌ Failed to load image:', err);
            Toastify({
                text: "❌ Failed to load image for editing",
                duration: 4000,
                gravity: "top",
                position: "center",
                style: { background: "#ff4444" }
            }).showToast();
            document.getElementById('tuiEditorModal').style.display = 'none';
        });
}

/**
 * Setup TUI editor save/close handlers
 */
function setupTuiEditorHandlers() {
    const closeBtn = document.getElementById('tuiEditorClose');
    const modal = document.getElementById('tuiEditorModal');

    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            if (tuiImageEditor) {
                tuiImageEditor.clearObjects();
                tuiImageEditor.clearRedoStack();
                tuiImageEditor.clearUndoStack();
            }
        };
    }

    const saveBtn = document.getElementById('tuiEditorSave');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            if (!tuiImageEditor || !isAdmin) return;

            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Saving...';

            try {
                const dataURL = tuiImageEditor.toDataURL();
                const blob = await fetch(dataURL).then(r => r.blob());
                const file = new File([blob], `edited_${Date.now()}.png`, { type: 'image/png' });

                const newImageUrl = await AdminActions.uploadImageToSupabase(file);

                const { data: post } = await supabaseClient
                    .from('posts')
                    .select('images(id)')
                    .eq('id', currentEditingPostId)
                    .single();

                if (post && post.images && post.images[currentEditingImageIndex]) {
                    const imageToUpdate = post.images[currentEditingImageIndex];

                    await supabaseClient
                        .from('images')
                        .update({ url: newImageUrl })
                        .eq('id', imageToUpdate.id);

                    Toastify({
                        text: "✅ Image updated successfully!",
                        duration: 3000,
                        gravity: "top",
                        position: "right",
                        style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
                    }).showToast();

                    modal.style.display = 'none';
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error('Image not found in post');
                }

            } catch (err) {
                console.error('❌ Save error:', err);
                Toastify({
                    text: `❌ Failed: ${err.message}`,
                    duration: 4000,
                    gravity: "top",
                    position: "right",
                    style: { background: "#ff4444" }
                }).showToast();
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Save';
            }
        };
    }
}

console.log('✅ Image gallery loaded');

// Make functions global
window.openTuiEditor = openTuiEditor;

// Export for other modules
window.ImageGallery = {
    initPhotoSwipe,
    initTuiEditor,
    openTuiEditor,
    setupTuiEditorHandlers
};
