// ============================================
// MAIN INITIALIZATION - App Entry Point
// ============================================

// Decide if this is single-post (shared) view
const urlParams = new URLSearchParams(window.location.search);
const isSinglePost = urlParams.has('post');

// Only initialize AOS for full feed (no ?post=...)
if (!isSinglePost && typeof AOS !== 'undefined') {
  AOS.init({
    duration: 500,
    once: true,
    offset: 50
  });
}


/**
 * Main initialization function
 * Called when DOM is ready
 */
async function initializeApp() {
    console.log('🚀 Initializing Facebook Archive...');
    
    try {
        // 1. Check admin status (if user is logged in)
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            currentUser = session.user;
            await SupabaseClient.checkAdminStatus();
        }
        
        // 2. Setup UI components
        console.log('📋 Setting up UI components...');
        UIHandlers.setupYearFilter();
        
        // 3. Load all posts from Supabase
        console.log('📥 Loading posts...');
        await DataLoader.loadAllPosts();
        
        // 4. Initialize search
        if (typeof Fuse !== 'undefined') {
            Search.initializeSearch();
            Search.setupSearch();
        } else {
            console.warn('⚠️ Fuse.js not loaded, search disabled');
        }
        
        // 5. Setup infinite scroll
        UIHandlers.setupScrollLoading();
        
        // 6. Setup touch gestures
        UIHandlers.setupTouchGestures();
        
        // 7. Initialize PhotoSwipe (with delay for posts to render)
        setTimeout(() => {
            ImageGallery.initPhotoSwipe();
        }, 1500);
        
        // 8. Setup mobile menu (with slight delay)
        setTimeout(() => {
            UIHandlers.setupMobileMenu();
        }, 500);
        
        // 9. Setup TUI editor handlers (if admin)
        ImageGallery.setupTuiEditorHandlers();
        
        // 10. Setup admin login modal
        setupAdminLogin();
        
        console.log('✅ App initialized successfully!');
        
    } catch (error) {
        console.error('❌ Initialization error:', error);

        // ✅ ADD THIS: Track errors
        if (window.posthog) {
            posthog.capture('error_init', {
            message: error.message,
            name: error.name
            });
        }
        
        // Show user-friendly error
        const container = document.getElementById('postsContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <h2>⚠️ Failed to load posts</h2>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #1877f2; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

/**
 * Setup admin login modal and handlers
 */
function setupAdminLogin() {
    const adminBtn = document.getElementById('adminLoginBtn');
    const adminModal = document.getElementById('adminLoginModal');
    const adminClose = document.querySelector('.admin-close');
    const adminSubmit = document.getElementById('adminLoginSubmit');
    
    if (!adminBtn || !adminModal) {
        console.warn('⚠️ Admin login elements not found');
        return;
    }
    
    // Admin button click
    adminBtn.onclick = function() {
        if (isAdmin) {
            SupabaseClient.logoutAdmin();
        } else {
            adminModal.style.display = 'flex';
        }
    };
    
    // Close modal
    if (adminClose) {
        adminClose.onclick = function() {
            adminModal.style.display = 'none';
        };
    }
    
    // Submit login
    if (adminSubmit) {
        adminSubmit.onclick = async function() {
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;
            const errorDiv = document.getElementById('adminLoginError');
            
            // Validate inputs
            if (!email || !password) {
                errorDiv.textContent = 'Please enter both email and password';
                return;
            }
            
            if (!Security.isValidEmail(email)) {
                errorDiv.textContent = 'Please enter a valid email address';
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
                const isAdminUser = await SupabaseClient.checkAdminStatus();
                
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
                
                Toastify({
                    text: `🎉 Welcome Admin! (${email})`,
                    duration: 3000,
                    gravity: "top",
                    position: "right",
                    style: { background: "linear-gradient(to right, #1877f2, #42b72a)" }
                }).showToast();
                
                location.reload();
                
            } catch (err) {
                console.error('❌ Login error:', err);
                errorDiv.textContent = 'Login failed. Please try again.';
                adminSubmit.disabled = false;
                adminSubmit.textContent = 'Login';
            }
        };
    }
    
    console.log('✅ Admin login setup complete');
}

// Scroll to specific post if ?post=xxx is in URL
function scrollToPostFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('post');

  if (!postId) return;

  // Wait a bit for posts to render
  setTimeout(() => {
    const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (postCard) {
      postCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Optional highlight
      postCard.style.backgroundColor = '#e7f3ff';
      setTimeout(() => {
        postCard.style.backgroundColor = '';
      }, 2000);
    }
  }, 1000);
}

// Start the app when DOM is ready
/** if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM already loaded
    initializeApp();
} */

// Call it after initialization
document.addEventListener('DOMContentLoaded', () => {
    initializeApp().then(() => {
        scrollToPostFromURL();
    });
});

console.log('✅ Main script loaded');
