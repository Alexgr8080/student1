// Student_supevision_system/js/auth.js

// Define global auth module events if not already defined (idempotent)
// This relies on events.js being loaded before this file, or these being defined in a shared scope.
// For robustness, this file can define them if SystemEvents is not found.
if (typeof window.SystemEvents === 'undefined') {
  console.warn('SystemEvents not defined. auth.js is defining its own. Load events.js first for a centralized definition.');
  window.SystemEvents = {
    AUTH_MODULE_READY: 'auth:module:ready', // More specific than AUTH_INITIALIZED
    AUTH_STATE_CHANGED: 'auth:state:changed',
    AUTH_ERROR: 'auth:error',
    // Add other system-wide events here if events.js isn't loaded first
  };
}


// Global state for the auth module
let authSupabaseClient = null;
let authCurrentUser = null;
let authUserOrganizationData = null; // Stores { organization: {id, name}, roles: [{id, name}] } etc.
let authModuleInitialized = false;
let authInitializing = false;
const authStateChangeListeners = new Set(); // For direct listeners, if any are still used


/**
 * Initializes the authentication module.
 * Fetches the Supabase client, gets the current user, and sets up auth state listeners.
 * Emits events for success or failure.
 * @param {Object} [providedSupabaseClient] - Optional pre-initialized Supabase client.
 * @returns {Promise<Object>} Resolves with { success: boolean, user: Object|null, orgData: Object|null, error?: string }
 */
async function initializeAuthModule(providedSupabaseClient) {
  if (authModuleInitialized) {
    return { success: true, user: authCurrentUser, orgData: authUserOrganizationData };
  }
  if (authInitializing) {
    // Wait for the ongoing initialization to complete
    return new Promise((resolve) => {
      const checkInit = () => {
        if (!authInitializing) {
          resolve({ success: authModuleInitialized, user: authCurrentUser, orgData: authUserOrganizationData });
        } else {
          setTimeout(checkInit, 100);
        }
      };
      checkInit();
    });
  }

  authInitializing = true;
  console.log('Auth module: Initializing...');

  try {
    authSupabaseClient = providedSupabaseClient || await window.getSupabaseClient();
    if (!authSupabaseClient) {
      throw new Error('Supabase client is required and could not be initialized.');
    }

    const { data: { user }, error: getUserError } = await authSupabaseClient.auth.getUser();
    if (getUserError) {
      // Non-critical error for getUser if no session, but log it
      console.warn('Auth module: Error getting initial user:', getUserError.message);
    }

    authCurrentUser = user;

    if (user) {
      authUserOrganizationData = await fetchUserOrganizationData(authSupabaseClient, user.id);
    } else {
      authUserOrganizationData = null;
    }

    setupAuthChangeListener(authSupabaseClient); // Setup listener regardless of initial user state

    authModuleInitialized = true;
    authInitializing = false;
    console.log('Auth module: Initialization successful.', { user: authCurrentUser, orgData: authUserOrganizationData });

    // Emit a more specific "ready" event.
    window.emitEvent(SystemEvents.AUTH_MODULE_READY, {
      user: authCurrentUser,
      orgData: authUserOrganizationData,
      success: true,
    });
    return { success: true, user: authCurrentUser, orgData: authUserOrganizationData };

  } catch (error) {
    authInitializing = false;
    authModuleInitialized = false; // Explicitly set to false on failure
    console.error('Auth module: Initialization failed:', error);
    window.emitEvent(SystemEvents.AUTH_ERROR, { error: error.message, details: error });
    return { success: false, user: null, orgData: null, error: error.message };
  }
}

/**
 * Sets up the Supabase auth state change listener.
 * @param {Object} supabaseClient - The initialized Supabase client.
 */
function setupAuthChangeListener(supabaseClient) {
  if (!supabaseClient || typeof supabaseClient.auth?.onAuthStateChange !== 'function') {
    console.error('Auth module: Supabase client or onAuthStateChange is invalid.');
    return;
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth module: Auth state changed - Event:', event);
    let userChanged = false;
    const previousUser = authCurrentUser;

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      if (session && session.user) {
        if (authCurrentUser?.id !== session.user.id || event === 'USER_UPDATED') { // Check if user actually changed or was updated
            userChanged = true;
        }
        authCurrentUser = session.user;
        authUserOrganizationData = await fetchUserOrganizationData(supabaseClient, session.user.id);
      } else if (!session && authCurrentUser !== null) { // Should not happen for SIGNED_IN but good for robustness
        userChanged = true;
        authCurrentUser = null;
        authUserOrganizationData = null;
      }
    } else if (event === 'SIGNED_OUT') {
      if (authCurrentUser !== null) {
        userChanged = true;
      }
      authCurrentUser = null;
      authUserOrganizationData = null;
    } else if (event === 'INITIAL_SESSION') {
        if (session && session.user) {
            if (authCurrentUser?.id !== session.user.id) {
                userChanged = true;
            }
            authCurrentUser = session.user;
            authUserOrganizationData = await fetchUserOrganizationData(supabaseClient, session.user.id);
        } else if (!session && authCurrentUser !== null) {
            userChanged = true;
            authCurrentUser = null;
            authUserOrganizationData = null;
        }
    }


    // Emit state changed event
    // The payload includes the event type for context, user, and orgData
    window.emitEvent(SystemEvents.AUTH_STATE_CHANGED, {
      event, // e.g., "SIGNED_IN", "SIGNED_OUT"
      user: authCurrentUser,
      orgData: authUserOrganizationData,
      previousUser: userChanged ? previousUser : null // Optionally include previous user if changed
    });

    // If module wasn't ready but now we have a session or confirmed no session,
    // and initialization wasn't explicitly run before.
    if (!authModuleInitialized && !authInitializing) {
        console.warn("Auth state changed before explicit initialization was marked complete. Finalizing initialization.");
        authModuleInitialized = true; // Mark as initialized
        window.emitEvent(SystemEvents.AUTH_MODULE_READY, {
            user: authCurrentUser,
            orgData: authUserOrganizationData,
            success: true,
        });
    }

    console.log('Auth module: User after state change:', authCurrentUser ? authCurrentUser.email : 'No user');
  });
}


/**
 * Fetches user's organization and roles data.
 * @param {Object} supabaseClient - The Supabase client.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Object|null>} Organization data or null.
 */
async function fetchUserOrganizationData(supabaseClient, userId) {
  if (!userId) {
    console.warn('Auth module: fetchUserOrganizationData called without userId.');
    return null;
  }
  if (!supabaseClient) {
    console.error('Auth module: Supabase client not available for fetchUserOrganizationData.');
    return null;
  }

  try {
    // This query assumes a 'user_organization_roles' link table and related 'organizations' and 'roles' tables.
    // Adjust the query to match your actual database schema.
    const { data: userOrgRoles, error } = await supabaseClient
      .from('user_organization_roles') // Junction table
      .select(`
        organization_id,
        role_id,
        organizations!inner (id, name), 
        roles!inner (id, name)        
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Auth module: Error fetching user organization roles:', error.message);
      return null;
    }

    if (!userOrgRoles || userOrgRoles.length === 0) {
      console.log('Auth module: No organization roles found for user:', userId);
      return { organizations: [], roles: [], /* for a single org context if applicable */ activeOrganization: null, hasRole: () => false, hasAnyRole: () => false };
    }

    // Assuming a user might belong to multiple organizations, but we simplify for one "active" one
    // or just list all roles across all orgs. For a multi-tenant app, this needs more logic.
    // For this system, let's assume one primary organization or aggregate roles.

    const organizations = [];
    const allRoles = [];

    userOrgRoles.forEach(item => {
      if (item.organizations && item.roles) {
        let org = organizations.find(o => o.id === item.organizations.id);
        if (!org) {
          org = { id: item.organizations.id, name: item.organizations.name, roles: [] };
          organizations.push(org);
        }
        if (!org.roles.some(r => r.id === item.roles.id)) {
          org.roles.push({ id: item.roles.id, name: item.roles.name });
        }
        if (!allRoles.some(r => r.id === item.roles.id)) {
          allRoles.push({ id: item.roles.id, name: item.roles.name });
        }
      }
    });
    
    // For simplicity, returning the first organization found as 'active' if needed, and all roles.
    // A more complex system would handle active organization selection.
    const activeOrganization = organizations.length > 0 ? organizations[0] : null;

    const orgData = {
      organizations, // Array of all organizations user belongs to
      activeOrganization, // Example: first org, or implement selection logic
      roles: allRoles, // Aggregated list of unique roles the user has across all their orgs
      hasRole: (roleName, orgId = null) => { // Check role, optionally within a specific org
        const targetOrg = orgId ? organizations.find(o => o.id === orgId) : activeOrganization;
        if (!targetOrg) return false;
        return targetOrg.roles.some(r => r.name.toLowerCase() === roleName.toLowerCase());
      },
      hasAnyRole: (roleName) => { // Check if user has this role in ANY of their organizations
        return organizations.some(org => org.roles.some(r => r.name.toLowerCase() === roleName.toLowerCase()));
      }
    };
    return orgData;

  } catch (error) {
    console.error('Auth module: Exception fetching user organization data:', error);
    return null;
  }
}

/**
 * Logs in a user with email and password.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @returns {Promise<Object>} { success: boolean, data?: Object, error?: Object }
 */
async function loginWithEmailPassword(email, password) {
  if (!authSupabaseClient) {
    return { success: false, error: { message: 'Auth client not initialized.' } };
  }
  try {
    const { data, error } = await authSupabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Auth module: Login error:', error.message);
      return { success: false, error };
    }
    // onAuthStateChange will handle updating global state and dispatching SIGNED_IN
    console.log('Auth module: Login successful for', email);
    return { success: true, data };
  } catch (error) {
    console.error('Auth module: Login process failed:', error);
    return { success: false, error: { message: error.message || 'An unexpected error occurred during login.' } };
  }
}

/**
 * Logs out the current user.
 * @returns {Promise<Object>} { success: boolean, error?: Object }
 */
async function logout() {
  if (!authSupabaseClient) {
    return { success: false, error: { message: 'Auth client not initialized.' } };
  }
  try {
    const { error } = await authSupabaseClient.auth.signOut();
    if (error) {
      console.error('Auth module: Logout error:', error.message);
      return { success: false, error };
    }
    // onAuthStateChange will handle updating global state and dispatching SIGNED_OUT
    console.log('Auth module: Logout successful.');
    return { success: true };
  } catch (error) {
    console.error('Auth module: Logout process failed:', error);
    return { success: false, error: { message: error.message || 'An unexpected error occurred during logout.' } };
  }
}

/**
 * Sends a password reset email.
 * @param {string} email - User's email.
 * @returns {Promise<Object>} { success: boolean, error?: Object }
 */
async function sendPasswordResetEmail(email) {
  if (!authSupabaseClient) {
    return { success: false, error: { message: 'Auth client not initialized.' } };
  }
  try {
    const { error } = await authSupabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${PathConfig.RESET_PASSWORD_PAGE || '/reset-password.html'}` // Ensure PathConfig is available
    });
    if (error) {
      console.error('Auth module: Password reset error:', error.message);
      return { success: false, error };
    }
    console.log('Auth module: Password reset email sent to', email);
    return { success: true };
  } catch (error) {
    console.error('Auth module: Password reset process failed:', error);
    return { success: false, error: { message: error.message || 'An unexpected error occurred.' } };
  }
}

/**
 * Updates the user's password. Typically used after a password reset flow.
 * @param {string} newPassword - The new password.
 * @returns {Promise<Object>} { success: boolean, error?: Object }
 */
async function updateUserPassword(newPassword) {
  if (!authSupabaseClient) {
    return { success: false, error: { message: 'Auth client not initialized.' } };
  }
  try {
    const { data, error } = await authSupabaseClient.auth.updateUser({ password: newPassword });
    if (error) {
      console.error('Auth module: Update password error:', error.message);
      return { success: false, error };
    }
    console.log('Auth module: Password updated successfully.');
    return { success: true, data };
  } catch (error) {
    console.error('Auth module: Update password process failed:', error);
    return { success: false, error: { message: error.message || 'An unexpected error occurred.' } };
  }
}


// --- Utility and Getter Functions ---

/**
 * Gets the current authenticated user.
 * @returns {Object|null} Current user object or null.
 */
function getCurrentUser() {
  return authCurrentUser;
}

/**
 * Gets the current user's organization data.
 * @returns {Object|null} User's organization and roles data or null.
 */
function getUserAuthOrganizationData() { // Renamed to avoid conflict if script.js has a similar global
  return authUserOrganizationData;
}

/**
 * Checks if the user has a specific role in their active/primary organization.
 * @param {string} roleName - The name of the role to check.
 * @returns {boolean} True if the user has the role.
 */
function hasRole(roleName) {
  if (!authUserOrganizationData || !authUserOrganizationData.activeOrganization || !authUserOrganizationData.activeOrganization.roles) {
    return false;
  }
  return authUserOrganizationData.activeOrganization.roles.some(r => r.name.toLowerCase() === roleName.toLowerCase());
}

/**
 * Checks if the user has a specific role in any of their organizations.
 * @param {string} roleName - The name of the role to check.
 * @returns {boolean} True if the user has the role in any organization.
 */
function hasAnyRole(roleName) {
  if (!authUserOrganizationData || !authUserOrganizationData.roles) { // Check aggregated roles
    return false;
  }
  return authUserOrganizationData.roles.some(r => r.name.toLowerCase() === roleName.toLowerCase());
}

/**
 * Requires authentication for accessing a page or feature. Redirects to login if not authenticated.
 * @param {string} [loginPath] - The path to redirect to for login. Defaults to PathConfig.LOGIN.
 * @returns {Promise<boolean>} True if authenticated, false otherwise (though redirection usually occurs).
 */
async function requireAuthentication(loginPath = (window.PathConfig?.LOGIN || '/login.html')) {
  if (!authModuleInitialized && !authInitializing) {
    console.warn('Auth module: requireAuthentication called before auth module fully initialized. Attempting to initialize.');
    await initializeAuthModule(); // Ensure initialization has run
  } else if (authInitializing) {
    await new Promise(resolve => { // Wait for pending initialization
        const waitInterval = setInterval(() => {
            if (!authInitializing) { clearInterval(waitInterval); resolve(); }
        }, 100);
    });
  }

  if (!authCurrentUser) {
    console.log('Auth module: Authentication required, redirecting to login.');
    window.location.href = `${loginPath}?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return false;
  }
  return true;
}

/**
 * Requires a specific role for accessing a page or feature.
 * Redirects if user is not authenticated or lacks the role.
 * @param {string|string[]} requiredRoles - A single role name or an array of role names.
 * @param {string} [unauthorizedPath] - Path for unauthorized access. Defaults to PathConfig.UNAUTHORIZED or login.
 * @param {string} [loginPath] - Path for login.
 * @returns {Promise<boolean>} True if user meets role requirements.
 */
async function requireRole(requiredRoles, unauthorizedPath = (window.PathConfig?.UNAUTHORIZED_PAGE || '/login.html?error=unauthorized'), loginPath = (window.PathConfig?.LOGIN || '/login.html')) {
  const isAuthenticated = await requireAuthentication(loginPath);
  if (!isAuthenticated) {
    return false; // requireAuthentication handles redirection
  }

  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  const userHasRole = roles.some(role => hasAnyRole(role)); // Use hasAnyRole for simplicity

  if (!userHasRole) {
    console.log(`Auth module: Role requirement not met. Required: ${roles.join('/')}. User has: ${authUserOrganizationData?.roles?.map(r => r.name).join('/') || 'No roles'}`);
    const redirectUrl = `${unauthorizedPath}${unauthorizedPath.includes('?') ? '&' : '?'}requiredRole=${encodeURIComponent(roles.join(','))}`;
    window.location.href = redirectUrl;
    return false;
  }
  return true;
}


// Expose public API for the auth module on the window object
window.auth = {
  initialize: initializeAuthModule,
  loginWithEmailPassword,
  logout,
  sendPasswordResetEmail,
  updateUserPassword,
  getCurrentUser,
  getUserOrganizationData: getUserAuthOrganizationData, // Expose renamed function
  hasRole,
  hasAnyRole,
  requireAuthentication,
  requireRole,
  // Constants for events if events.js isn't loaded first (fallback)
  AuthEvents: window.SystemEvents || {
    AUTH_MODULE_READY: 'auth:module:ready',
    AUTH_STATE_CHANGED: 'auth:state:changed',
    AUTH_ERROR: 'auth:error',
  }
};

// Automatically initialize the auth module when script is loaded if not already handled by app.js
// This ensures that onAuthStateChange listener is set up early.
// The app.js should still call initializeAuthModule to ensure full setup and get the user.
if (!authModuleInitialized && !authInitializing) {
    // Initial, lightweight setup of the listener.
    // The main app.js will call initializeAuthModule() again which will resolve quickly if already done.
    window.getSupabaseClient().then(client => {
        if(client) setupAuthChangeListener(client);
    }).catch(err => {
        console.error("Auth.js: Failed to get Supabase client for early listener setup:", err);
    });
}

console.log('auth.js loaded and auth API is available on window.auth');
async function initializeWithRetry(maxRetries = 3, delay = 1000) {
    let retries = 0;
    
    async function attempt() {
        try {
            const result = await initializeAuthModule();
            console.log("Auth module initialized successfully via initializeWithRetry.");
            return result;
        } catch (error) {
            if (retries < maxRetries) {
                retries++;
                console.warn(`Auth module initialization failed, retrying (${retries}/${maxRetries})...`);
                return new Promise(resolve => setTimeout(() => resolve(attempt()), delay));
            }
            throw error;
        }
    }
    
    return attempt();
}

// Make available globally
window.auth = {
    initialize: initializeWithRetry,
    getCurrentUser: async function() {
        if (window.authCurrentUserGlobal) {
            return { user: window.authCurrentUserGlobal, error: null };
        }
        
        const supabaseClient = getSupabaseClient();
        if (!supabaseClient) {
            return { user: null, error: new Error("Supabase client not available") };
        }
        
        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) {
                throw error;
            }
            
            window.authCurrentUserGlobal = data.user;
            return { user: data.user, error: null };
        } catch (error) {
            console.error("Error getting current user:", error);
            return { user: null, error };
        }
    },
    signOut: async function() {
        const supabaseClient = getSupabaseClient();
        if (!supabaseClient) {
            return { error: new Error("Supabase client not available") };
        }
        
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                throw error;
            }
            
            window.authCurrentUserGlobal = null;
            return { error: null };
        } catch (error) {
            console.error("Error signing out:", error);
            return { error };
        }
    },
    // Add other auth-related methods here
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded. Initializing auth module with retry...");
    initializeWithRetry().catch(error => {
        console.error("Failed to initialize auth module after retries:", error);
    });
});

console.log("auth.js loaded and auth API is available on window.auth");