// ============================================
// SUPABASE CLIENT & USER MANAGEMENT
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

// Get or prompt for username with beautiful modal
function getUsername() {
    return localStorage.getItem('fb_username') || null;
}

// New function to show modal and get username
async function promptUsername() {
    return new Promise((resolve) => {
        const modal = document.getElementById('usernameModal');
        const input = document.getElementById('usernameInput');
        const submitBtn = document.getElementById('usernameSubmit');
        const skipBtn = document.getElementById('usernameSkip');
        const charCount = document.getElementById('charCount');

        // Show modal
        modal.style.display = 'flex';
        
        // Focus input after animation
        setTimeout(() => input.focus(), 300);

        // Character counter
        input.addEventListener('input', () => {
            const length = input.value.length;
            if (length > 0) {
                charCount.textContent = `${length}/50`;
            } else {
                charCount.textContent = '';
            }
        });

        // Handle submit
        const handleSubmit = () => {
            let username = input.value.trim();
            
            if (!username || username === '') {
                username = 'Anonymous_' + Math.random().toString(36).substr(2, 5);
            } else {
                username = Security.sanitizeHTML(username);
            }
            
            localStorage.setItem('fb_username', username);
            modal.style.display = 'none';
            
            // ✅ Identify in PostHog
            try {
                if (typeof posthog !== 'undefined') {
                    const distinctId = posthog.get_distinct_id();
                    posthog.identify(distinctId, {
                        username: username,
                    });
                    console.log('✅ PostHog identified:', username);
                }
            } catch (e) {
                console.warn('PostHog identify failed:', e);
            }
            
            resolve(username);
        };

        // Handle skip
        const handleSkip = () => {
            const username = 'Anonymous_' + Math.random().toString(36).substr(2, 5);
            localStorage.setItem('fb_username', username);
            modal.style.display = 'none';
            
            // Still identify anonymous users
            try {
                if (typeof posthog !== 'undefined') {
                    const distinctId = posthog.get_distinct_id();
                    posthog.identify(distinctId, {
                        username: username,
                    });
                }
            } catch (e) {
                console.warn('PostHog identify failed:', e);
            }
            
            resolve(username);
        };

        // Enter key submits
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSubmit();
        });

        submitBtn.onclick = handleSubmit;
        skipBtn.onclick = handleSkip;
    });
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
}

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

// Enable admin features
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

    console.log('✅ ADMIN MODE ENABLED');
    console.log('isAdmin:', isAdmin);
    console.log('currentUser:', currentUser);
}

// Logout admin
async function logoutAdmin() {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('fb_admin');
    localStorage.removeItem('fb_admin_email');
    isAdmin = false;
    currentUser = null;
    
    Toastify({
        text: "👋 Logged out successfully",
        duration: 2000,
        gravity: "top",
        position: "center",
        style: { background: "#1877f2" }
    }).showToast();
    
    location.reload();
}

console.log('✅ Supabase client loaded');

// Export for other modules
window.SupabaseClient = {
    getUserId,
    getUsername,
    promptUsername,
    logUserActivity,
    checkAdminStatus,
    enableAdminFeatures,
    logoutAdmin
};