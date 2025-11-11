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
        const cleanedContent = cleanContent(post.content);
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
function setupImageModal() {
    const modal = document.createElement('div');
    modal.id = 'imageModal';
    modal.style.cssText = 'display:none;position:fixed;z-index:10000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.9);justify-content:center;align-items:center;';

    const modalImg = document.createElement('img');
    modalImg.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;touch-action:pan-y;'; // allow horizontal swipe
    modalImg.alt = ''; // decorative; set alt when appropriate

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'position:absolute;top:20px;right:24px;color:white;font-size:50px;font-weight:bold;cursor:pointer;border:none;background:transparent;user-select:none;';
    closeBtn.onclick = () => closeModal();

    // Next/Prev arrows (buttons for accessibility)
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.setAttribute('aria-label', 'Previous image');
    prevBtn.textContent = '<';
    prevBtn.style.cssText = 'position:absolute;top:50%;left:12px;transform:translateY(-50%);color:white;font-size:48px;font-weight:bold;cursor:pointer;padding:18px;user-select:none;border:none;background:transparent;z-index:10;';
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.setAttribute('aria-label', 'Next image');
    nextBtn.textContent = '>';
    nextBtn.style.cssText = 'position:absolute;top:50%;right:12px;transform:translateY(-50%);color:white;font-size:48px;font-weight:bold;cursor:pointer;padding:18px;user-select:none;border:none;background:transparent;z-index:10;';

    let imageArray = [];
    let currentIdx = 0;

    function updateButtons() {
        prevBtn.disabled = currentIdx <= 0;
        nextBtn.disabled = currentIdx >= imageArray.length - 1;
        prevBtn.style.opacity = prevBtn.disabled ? '0.4' : '1';
        nextBtn.style.opacity = nextBtn.disabled ? '0.4' : '1';
    }

    function preloadImage(idx) {
        if (idx < 0 || idx >= imageArray.length) return;
        const p = new Image();
        p.src = imageArray[idx];
    }

    prevBtn.onclick = function(e) {
        e.stopPropagation();
        if (currentIdx > 0) {
            currentIdx--;
            modalImg.src = imageArray[currentIdx];
            updateButtons();
            preloadImage(currentIdx - 1);
        }
    };
    nextBtn.onclick = function(e) {
        e.stopPropagation();
        if (currentIdx < imageArray.length - 1) {
            currentIdx++;
            modalImg.src = imageArray[currentIdx];
            updateButtons();
            preloadImage(currentIdx + 1);
        }
    };

    // Touch swipe support (handle horizontal swipes on the modal)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;

    modal.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchMoved = false;
    }, {passive: true});

    modal.addEventListener('touchmove', (e) => {
        touchMoved = true;
    }, {passive: true});

    modal.addEventListener('touchend', (e) => {
        if (!e.changedTouches || e.changedTouches.length === 0) return;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const dx = endX - touchStartX;
        const dy = endY - touchStartY;

        // ignore mostly-vertical gestures
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
                // swipe right -> previous
                if (currentIdx > 0) prevBtn.onclick();
            } else {
                // swipe left -> next
                if (currentIdx < imageArray.length - 1) nextBtn.onclick();
            }
        } else if (!touchMoved) {
            // a simple tap on backdrop should close only if tapped outside the image
            // handled by modal click below
        }
    }, {passive: true});

    // Keyboard navigation
    function onKeyDown(e) {
        if (modal.style.display !== 'flex') return;
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') prevBtn.onclick();
        if (e.key === 'ArrowRight') nextBtn.onclick();
    }
    document.addEventListener('keydown', onKeyDown);

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        // remove src to stop downloads if needed
        modalImg.src = '';
    }

    // Append elements
    modal.appendChild(prevBtn);
    modal.appendChild(modalImg);
    modal.appendChild(nextBtn);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);

    // Expose function globally
    window.openImageModal = function(src, imagesList = [src]) {
        imageArray = imagesList.slice(); // copy
        currentIdx = imageArray.indexOf(src);
        if (currentIdx < 0) currentIdx = 0;
        modal.style.display = 'flex';
        modalImg.src = imageArray[currentIdx];
        updateButtons();
        // preload neighbors
        preloadImage(currentIdx + 1);
        preloadImage(currentIdx - 1);
        document.body.style.overflow = 'hidden';
    };

    // Close when clicking backdrop (but not when clicking the image or controls)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // prevent clicks on image from bubbling (so clicking image doesn't close modal)
    modalImg.addEventListener('click', (e) => e.stopPropagation());

    // cleanup on unload if needed
    window.addEventListener('beforeunload', () => {
        document.removeEventListener('keydown', onKeyDown);
    });
}

console.log('Facebook Complete JS Loaded');


console.log('Facebook Complete JS Loaded');



