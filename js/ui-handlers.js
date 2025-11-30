// ============================================
// UI EVENT HANDLERS & INTERACTIONS
// ============================================

/**
 * Setup mobile hamburger menu
 */
function setupMobileMenu() {
    console.log('🍔 Setting up mobile menu...');
    
    const menuBtn = document.getElementById('mobileMenuBtn');
    const dropdown = document.getElementById('mobileDropdown');
    
    if (!menuBtn || !dropdown) {
        console.error('❌ Hamburger menu elements not found!');
        if (window.posthog) {
            posthog.captureException(err, {
                func: 'setupMobileMenu',
                postId
            });
        }
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
            console.log('📱 Menu item clicked');
            menuBtn.classList.remove('active');
            dropdown.classList.remove('active');
        });
    });
    
    // Connect mobile buttons to desktop buttons
    connectMobileButtons();
    
    console.log('✅ Mobile menu setup complete!');
}

/**
 * Connect mobile buttons to desktop button functionality
 */
function connectMobileButtons() {
    // Notification button
    const notificationBtnMobile = document.getElementById('notificationBtnMobile');
    const notificationBtnDesktop = document.getElementById('notificationBtn');
    if (notificationBtnMobile && notificationBtnDesktop) {
        notificationBtnMobile.onclick = function() {
            notificationBtnDesktop.click();
        };
    }
    
    // Admin login button
    const adminLoginBtnMobile = document.getElementById('adminLoginBtnMobile');
    const adminLoginBtnDesktop = document.getElementById('adminLoginBtn');
    if (adminLoginBtnMobile && adminLoginBtnDesktop) {
        adminLoginBtnMobile.onclick = function() {
            adminLoginBtnDesktop.click();
        };
    }
    
    // Admin add post button
    const adminAddPostBtnMobile = document.getElementById('adminAddPostBtnMobile');
    const adminAddPostBtnDesktop = document.getElementById('adminAddPostBtn');
    if (adminAddPostBtnMobile && adminAddPostBtnDesktop) {
        adminAddPostBtnMobile.onclick = function() {
            adminAddPostBtnDesktop.click();
        };
        
        // Sync visibility
        if (typeof AdminActions !== 'undefined' && AdminActions.syncAddPostButtonVisibility) {
            AdminActions.syncAddPostButtonVisibility();
        }
    }
}

/**
 * Setup year filter dropdown
 */
function setupYearFilter() {
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) {
        console.warn('⚠️ Year filter not found');
        return;
    }
    
    // Clear existing options to prevent duplicates
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
        
        window.currentPage = 0;
        document.getElementById('postsContainer').innerHTML = '';
        if (window.PostRenderer && typeof window.PostRenderer.renderPosts === 'function') {
        window.PostRenderer.renderPosts();
        } else {
        console.warn('PostRenderer not ready yet for yearFilter');
        }
        
        console.log(`✅ Filtered by year: ${selectedYear} (${filteredPosts.length} posts)`);
    });
    
    console.log('✅ Year filter setup complete');
}

/**
 * Setup infinite scroll loading
 */
function setupScrollLoading() {
    const debouncedScroll = Utils.debounce(() => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
            if (window.PostRenderer && typeof window.PostRenderer.renderPosts === 'function') {
                if (currentPage * POSTS_PER_PAGE < filteredPosts.length) {
                    window.PostRenderer.renderPosts();
                }
                } else {
                console.warn('PostRenderer not ready yet for scroll load');
                }
        }
    }, 150);
    
    window.addEventListener('scroll', debouncedScroll, { passive: true });
    console.log('✅ Infinite scroll setup complete');
}

/**
 * Setup touch gesture support for image modal
 */
function setupTouchGestures() {
    const modal = document.getElementById('imageModal');
    if (!modal) {
        console.warn('⚠️ Image modal not found, touch gestures skipped');
        return;
    }
    
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
            if (typeof navigateImage === 'function') {
                navigateImage(1);
            }
        }
        if (touchEndX > touchStartX + swipeThreshold) {
            if (typeof navigateImage === 'function') {
                navigateImage(-1);
            }
        }
    }
    
    console.log('✅ Touch gestures setup complete');
}


/**
 * Setup photo grid in sidebar (optional)
 */
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
            img.onclick = () => {
                if (typeof openImageModal === 'function') {
                    openImageModal(post.images[0], post.images);
                }
            };
            img.onerror = () => img.style.display = 'none';
            photoGrid.appendChild(img);
        }
    });
    
    console.log('✅ Photo grid loaded');
}

console.log('✅ UI handlers loaded');

// Export for other modules
window.UIHandlers = {
    setupMobileMenu,
    setupYearFilter,
    setupScrollLoading,
    setupTouchGestures,
    loadPhotoGrid
};
