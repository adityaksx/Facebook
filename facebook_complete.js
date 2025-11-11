const JSON_DATA_FOLDER = 'facebook_json_data';
const AVAILABLE_YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

let allPosts = [];
let filteredPosts = [];
let currentPage = 0;
const POSTS_PER_PAGE = 10;

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
    loadAllPosts();
    setupImageModal();
    setupScrollLoading();
    setupLazyLoadingWithBlur();
});

function setupYearFilter() {
    const yearFilter = document.getElementById('yearFilter');
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

async function loadAllPosts() {
    const loadingDiv = document.getElementById('loadingIndicator');
    loadingDiv.style.display = 'block';
    const promises = AVAILABLE_YEARS.map(year =>
        fetch(`${JSON_DATA_FOLDER}/posts_${year}.json`)
            .then(res => res.ok ? res.json() : null)
            .catch(() => null)
    );
    const results = await Promise.all(promises);
    allPosts = [];
    results.forEach((data, index) => {
        if (data && data.posts) {
            allPosts.push(...data.posts);
        }
    });
    allPosts.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
    filteredPosts = [...allPosts];
    loadingDiv.style.display = 'none';
    document.getElementById('totalPosts').textContent = allPosts.length;
    renderPosts();
    loadPhotoGrid();
}

function renderPosts() {
    const container = document.getElementById('postsContainer');
    const start = currentPage * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    const postsToRender = filteredPosts.slice(start, end);

    if (postsToRender.length === 0 && currentPage === 0) {
        container.innerHTML = '<div class="no-posts"><p>No posts to display</p></div>';
        return;
    }

    // Build all post nodes first, keep them in an array
    const fragment = document.createDocumentFragment();
    postsToRender.forEach((post) => {
        const postCard = createPostCard(post);
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


function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';

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
        textDiv.innerHTML = processHashtags(cleanedContent);
        contentDiv.appendChild(textDiv);
        card.appendChild(contentDiv);
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

    // STATS
    const stats = document.createElement('div');
    stats.className = 'post-stats';
    stats.innerHTML = `
        <div class="likes">👍 ❤️ 😆 25</div>
        <div class="comments-shares">10 Comments · 5 Shares</div>
    `;
    card.appendChild(stats);

    // ACTIONS
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    actions.innerHTML = `
        <button class="action-btn"><span class="icon">👍</span> Like</button>
        <button class="action-btn"><span class="icon">💬</span> Comment</button>
        <button class="action-btn"><span class="icon">↗</span> Share</button>
    `;
    card.appendChild(actions);

    return card;
}

// Clean content
function cleanContent(content) {
    if (!content) return '';
    const stopPhrases = [
        'mobile uploads', 'satyapal singh',
        'added a new photo', 'added photos', 'date unknown'
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
    
    // TOUCH START
    imageWrapper.addEventListener('touchstart', (e) => {
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
    imageWrapper.addEventListener('touchmove', (e) => {
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
    imageWrapper.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1 && e.touches.length === 0) {
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);
            
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
            } else if (!touchMoved) {
                // Quick tap - toggle zoom
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
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');  // ← ADD THIS LINE
        document.body.style.overflow = 'auto';
        modalImg.src = '';
    }
    
    overlay.onclick = closeModal;
    container.onclick = (e) => e.stopPropagation();
    
    window.openImageModal = function(src, imagesList = [src]) {
        imageArray = imagesList.slice();
        currentIdx = imageArray.indexOf(src);
        if (currentIdx < 0) currentIdx = 0;
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');  // ← ADD THIS LINE
        modalImg.src = imageArray[currentIdx];
        updateButtons();
        preloadImage(currentIdx + 1);
        preloadImage(currentIdx - 1);
        document.body.style.overflow = 'hidden';
    };
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

function openImageModal(imageSrc, allImages) {
    window._scrollY = window.scrollY || window.pageYOffset;
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const imageCounter = document.getElementById('imageCounter');
    const thumbnailStrip = document.getElementById('thumbnailStrip');
    
    // Store all images for navigation
    window.currentImages = allImages;
    window.currentImageIndex = allImages.indexOf(imageSrc);
    
    // Show modal immediately
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    
    // Force image to be visible and load immediately
    modalImage.style.opacity = '1';
    modalImage.style.display = 'block';
    modalImage.onload = function() {
        modalImage.style.opacity = '1';
    };
    modalImage.src = imageSrc;
    
    // Update counter
    imageCounter.textContent = `${window.currentImageIndex + 1} / ${allImages.length}`;
    
    // Generate thumbnails
    thumbnailStrip.innerHTML = '';
    allImages.forEach((img, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'thumbnail' + (index === window.currentImageIndex ? ' active' : '');
        
        const thumbImg = document.createElement('img');
        thumbImg.src = img;
        thumbImg.alt = `Image ${index + 1}`;
        thumb.appendChild(thumbImg);
        
        thumb.onclick = (e) => {
            e.stopPropagation();
            showImage(index);
        };
        
        thumbnailStrip.appendChild(thumb);
    });
    
    // Update navigation buttons
    updateNavButtons();
}

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
