// Student_supevision_system/js/app.js - New centralized initialization file

/**
 * Main application initialization sequence.
 * This function coordinates the loading of essential modules and user redirection.
 */
async function initializeApp() {
  if (typeof window.SystemEvents === 'undefined') {
    console.error('App.js: SystemEvents is not defined. Ensure events.js is loaded before app.js.');
    showErrorMessage('Critical system file (events.js) missing. Please contact support.'); // Assumes showErrorMessage is global
    return;
  }
  if (typeof window.PathConfig === 'undefined') {
    console.error('App.js: PathConfig is not defined. Ensure script.js is loaded before app.js.');
    showErrorMessage('Critical system file (PathConfig) missing. Please contact support.');
    return;
  }

  window.emitEvent(SystemEvents.APP_INIT_STARTED);
  showLoadingIndicator('Initializing system...');

  try {
    const supabase = await window.getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client initialization failed after multiple retries.');
    }
    console.log('App.js: Supabase client retrieved successfully.');
    window.emitEvent(SystemEvents.SUPABASE_CLIENT_INITIALIZED, { client: supabase });
    updateLoadingStatus('Authenticating user...');

    const authInitResult = await window.auth.initialize(supabase);
    if (!authInitResult.success) {
      throw new Error(`Authentication module failed to initialize: ${authInitResult.error}`);
    }
    console.log('App.js: Auth module initialized.');

    const { user, orgData } = authInitResult;

    if (!user) {
      const publicPages = [
        window.PathConfig.LOGIN,
        window.PathConfig.RESET_PASSWORD_PAGE,
        window.PathConfig.TERMS_OF_SERVICE,
        window.PathConfig.PRIVACY_POLICY,
        window.PathConfig.HELP_AND_CONTACT,
        // Add any other public HTML file paths here using PathConfig values
      ].filter(Boolean);

      // Normalize current path for comparison
      const currentPathname = window.location.pathname.startsWith('/') ? window.location.pathname : '/' + window.location.pathname;

      if (!publicPages.some(page => currentPathname.endsWith(page))) {
        console.log('App.js: No authenticated user and not on a public page. Redirecting to login.');
        window.location.href = window.PathConfig.LOGIN;
        return;
      } else {
        console.log('App.js: On a public page, no user authenticated. Public page will load.');
      }
    } else {
      // User is authenticated
      console.log('App.js: User authenticated. Attempting to initialize dashboard or redirect.');
      updateLoadingStatus('Loading user dashboard...');

      const dashboardWasInitializedForCurrentPage = await initializeDashboard(user, orgData);

      if (!dashboardWasInitializedForCurrentPage) {
        // If user is logged in, but the current page isn't their dashboard (e.g. they are on login.html)
        // OR if their dashboard init function was missing for the current page.
        // Redirect them to their default dashboard.
        console.log('App.js: Current page is not a specific dashboard for this user OR init function missing. Redirecting to default dashboard.');
        redirectToUserDefaultDashboard(user, orgData);
        return; // Stop further execution as we are redirecting
      }
      // If dashboardWasInitializedForCurrentPage is true, the correct dashboard for the current page has loaded.
    }

    console.log('App.js: System initialization sequence complete.');
    window.emitEvent(SystemEvents.APP_INIT_SUCCESS);

  } catch (error) {
    console.error('App.js: Initialization failed catastrophically:', error);
    window.emitEvent(SystemEvents.APP_INIT_FAILED, { error: error.message });
    showErrorMessage(`System initialization failed: ${error.message}. Please try refreshing the page or contact support.`);
    return;
  }

  hideLoadingIndicator();
}

/**
 * Initializes the appropriate dashboard based on the user's role and current page.
 * @param {Object} user - The authenticated user object from Supabase.
 * @param {Object} orgData - The user's organization and role data from auth.js.
 * @returns {Promise<boolean>} True if a dashboard relevant to the current page was initialized, false otherwise.
 */
async function initializeDashboard(user, orgData) {
  if (!user || !orgData) {
    console.error('App.js: Cannot initialize dashboard without user or organization data.');
    throw new Error('User or organization data is missing for dashboard initialization.');
  }

  const isAdmin = orgData.hasAnyRole && orgData.hasAnyRole('admin');
  const isStudent = orgData.hasAnyRole && orgData.hasAnyRole('student');
  const isSupervisor = orgData.hasAnyRole && orgData.hasAnyRole('supervisor');
  const isCommittee = orgData.hasAnyRole && orgData.hasAnyRole('committee');
  const isMarker = orgData.hasAnyRole && orgData.hasAnyRole('marker');

  let dashboardActuallyLoadedForThisPage = false;
  const currentPath = window.location.pathname;

  try {
    // Check for specific page initializations first
    if (isStudent && currentPath.endsWith(PathConfig.THESIS_SUBMISSION_FILENAME)) {
        if (typeof window.initializeThesisSubmission === 'function') {
            console.log('App.js: Initializing Thesis Submission Page...');
            window.emitEvent(SystemEvents.DASHBOARD_INIT_STARTED, { dashboard: 'thesis-submission' });
            await window.initializeThesisSubmission(user, orgData);
            dashboardActuallyLoadedForThisPage = true;
        } else console.warn('App.js: initializeThesisSubmission function not found.');
    } else if (isStudent && currentPath.endsWith(PathConfig.ETHICS_FORM_FILENAME)) {
        if (typeof window.initializeEthicsForm === 'function') {
            console.log('App.js: Initializing Ethics Form Page...');
            window.emitEvent(SystemEvents.DASHBOARD_INIT_STARTED, { dashboard: 'ethics-form' });
            await window.initializeEthicsForm(user, orgData); // Assuming it takes user, orgData
            dashboardActuallyLoadedForThisPage = true;
        } else console.warn('App.js: initializeEthicsForm function not found.');
    } else if ((isSupervisor || isAdmin || isCommittee) && currentPath.endsWith(PathConfig.ETHICS_REVIEW_FILENAME)) {
        if (typeof window.initializeEthicsFormReview === 'function') {
            console.log('App.js: Initializing Ethics Review Page...');
            window.emitEvent(SystemEvents.DASHBOARD_INIT_STARTED, { dashboard: 'ethics-review' });
            await window.initializeEthicsFormReview(user, orgData);
            dashboardActuallyLoadedForThisPage = true;
        } else console.warn('App.js: initializeEthicsFormReview function not found.');
    } else if (isMarker && currentPath.endsWith(PathConfig.THESIS_MARKING_FILENAME)) {
        if (typeof window.initializeThesisMarking === 'function') {
            console.log('App.js: Initializing Thesis Marking Page...');
            window.emitEvent(SystemEvents.DASHBOARD_INIT_STARTED, { dashboard: 'thesis-marking' });
            await window.initializeThesisMarking(user, orgData); // Assuming it takes user, orgData
            dashboardActuallyLoadedForThisPage = true;
        } else console.warn('App.js: initializeThesisMarking function not found.');
    }
    // Then check for main dashboard pages
    else if (isAdmin && currentPath.endsWith(PathConfig.ADMIN_DASHBOARD_FILENAME)) {
      if (typeof window.initializeAdminDashboard === 'function') {
        console.log('App.js: Initializing Admin Dashboard...');
        window.emitEvent(SystemEvents.DASHBOARD_INIT_STARTED, { dashboard: 'admin' });
        await window.initializeAdminDashboard(user, orgData);
        dashboardActuallyLoadedForThisPage = true;
      } else console.warn('App.js: initializeAdminDashboard function not found.');
    } else if (isStudent && currentPath.endsWith(PathConfig.STUDENT_DASHBOARD_FILENAME)) {
      if (typeof window.initializeStudentDashboard === 'function') {
        console.log('App.js: Initializing Student Dashboard...');
        window.emitEvent(SystemEvents.DASHBOARD_INIT_STARTED, { dashboard: 'student' });
        await window.initializeStudentDashboard(user, orgData);
        dashboardActuallyLoadedForThisPage = true;
      } else console.warn('App.js: initializeStudentDashboard function not found.');
    } else if (isSupervisor && currentPath.endsWith(PathConfig.SUPERVISOR_DASHBOARD_FILENAME)) {
      if (typeof window.initializeSupervisorDashboard === 'function') {
        console.log('App.js: Initializing Supervisor Dashboard...');
        window.emitEvent(SystemEvents.DASHBOARD_INIT_STARTED, { dashboard: 'supervisor' });
        await window.initializeSupervisorDashboard(user, orgData);
        dashboardActuallyLoadedForThisPage = true;
      } else console.warn('App.js: initializeSupervisorDashboard function not found.');
    } else if (isCommittee && currentPath.endsWith(PathConfig.COMMITTEE_DASHBOARD_FILENAME)) {
        if (typeof window.initializeCommitteeModule === 'function') {
            console.log('App.js: Initializing Committee Dashboard...');
            window.emitEvent(SystemEvents.DASHBOARD_INIT_STARTED, { dashboard: 'committee' });
            await window.initializeCommitteeModule(user, orgData); // Assuming it takes user, orgData
            dashboardActuallyLoadedForThisPage = true;
        } else console.warn('App.js: initializeCommitteeModule function not found.');
    } else if (isMarker && currentPath.endsWith(PathConfig.MARKER_DASHBOARD_FILENAME)) {
        if (typeof window.initializeMarkerDashboard === 'function') {
            console.log('App.js: Initializing Marker Dashboard...');
            window.emitEvent(SystemEvents.DASHBOARD_INIT_STARTED, { dashboard: 'marker' });
            await window.initializeMarkerDashboard(user, orgData); // Assuming it takes user, orgData
            dashboardActuallyLoadedForThisPage = true;
        } else console.warn('App.js: initializeMarkerDashboard function not found.');
    }


    if (dashboardActuallyLoadedForThisPage) {
      console.log('App.js: Specific page/dashboard initialized successfully for current page.');
      window.emitEvent(SystemEvents.DASHBOARD_INIT_SUCCESS, { user, role: orgData?.roles?.[0]?.name || 'unknown', page: currentPath });
      return true; // Indicate a dashboard/page logic was successfully run for the current page
    } else {
      console.log('App.js: No specific page/dashboard matched for this page AND user role, or its init function was missing.');
      return false; // Indicate no specific dashboard/page logic was run for the current page
    }
  } catch (error) {
    console.error('App.js: Dashboard/page initialization error for path ' + currentPath + ' :', error);
    window.emitEvent(SystemEvents.DASHBOARD_INIT_FAILED, { error: error.message, page: currentPath });
    showErrorMessage(`Failed to load content for this page: ${error.message}`);
    return false; // Indicate dashboard/page loading failed for the current page
  }
}


/**
 * Redirects the authenticated user to their default dashboard based on their role.
 * @param {Object} user - The authenticated user object.
 * @param {Object} orgData - The user's organization and role data.
 */
function redirectToUserDefaultDashboard(user, orgData) {
    if (!user || !orgData || !window.PathConfig) {
        console.error('App.js: Cannot redirect, missing user, orgData, or PathConfig.');
        window.location.href = window.PathConfig?.LOGIN || '/login.html'; // Fallback
        return;
    }

    // Role checks using orgData from auth.js
    const isAdmin = orgData.hasAnyRole && orgData.hasAnyRole('admin');
    const isStudent = orgData.hasAnyRole && orgData.hasAnyRole('student');
    const isSupervisor = orgData.hasAnyRole && orgData.hasAnyRole('supervisor');
    const isCommittee = orgData.hasAnyRole && orgData.hasAnyRole('committee');
    const isMarker = orgData.hasAnyRole && orgData.hasAnyRole('marker');

    let targetPath = null;

    if (isAdmin) targetPath = window.PathConfig.ADMIN_DASHBOARD;
    else if (isStudent) targetPath = window.PathConfig.STUDENT_DASHBOARD;
    else if (isSupervisor) targetPath = window.PathConfig.SUPERVISOR_DASHBOARD;
    else if (isCommittee) targetPath = window.PathConfig.COMMITTEE_DASHBOARD;
    else if (isMarker) targetPath = window.PathConfig.MARKERS;

    if (targetPath && targetPath !== window.location.pathname) { // Only redirect if not already on the target dashboard
        console.log(`App.js: Redirecting user ${user.email} to default dashboard: ${targetPath}`);
        window.location.href = targetPath;
    } else if (!targetPath) {
        console.warn(`App.js: User ${user.email} has no recognized default dashboard. Staying on current page or redirecting to login with error.`);
        // If already on login, show error. Otherwise, redirect to login with error.
        if (!window.location.pathname.endsWith(window.PathConfig.LOGIN)) {
            window.location.href = `${window.PathConfig.LOGIN}?error=${encodeURIComponent('No default dashboard found for your role.')}`;
        } else {
            showErrorMessage('No default dashboard found for your role. Please contact support.');
        }
    } else {
        console.log(`App.js: User is already on their target dashboard or a non-dashboard page after login: ${window.location.pathname}`);
        // This case means they were on their dashboard, or another authenticated page that isn't a "default" redirect target.
        // No redirect needed here, the page specific logic (if any) should have run.
    }
}


// --- Global Helper Functions for UI feedback (ensure these are robustly defined, e.g., in script.js) ---

function showLoadingIndicator(message) {
  const overlay = document.getElementById('loadingOverlay');
  const msgElement = document.getElementById('loadingMessage');
  if (overlay) {
    if (msgElement) msgElement.textContent = message || 'Loading...';
    overlay.style.display = 'flex'; // Ensure it's visible
    overlay.classList.remove('hidden');
  } else {
    console.log('Loading:', message);
  }
}

function updateLoadingStatus(message) {
  const msgElement = document.getElementById('loadingMessage');
  if (msgElement) {
    msgElement.textContent = message;
  } else {
    console.log('Loading status:', message);
  }
}

function hideLoadingIndicator() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.classList.add('hidden');
  }
}

function showErrorMessage(message, details = '') {
  const errorOverlay = document.getElementById('errorOverlay');
  const errorMessageElement = document.getElementById('errorMessage');

  if (errorOverlay && errorMessageElement) {
    errorMessageElement.innerHTML = `${message}${details ? `<br><small class="text-xs text-gray-500">${details}</small>` : ''}`;
    hideLoadingIndicator();
    errorOverlay.style.display = 'flex';
    errorOverlay.classList.remove('hidden');

    // Ensure retry button is available if not already handled
    const retryBtn = errorOverlay.querySelector('#retryButton');
    if (retryBtn && !retryBtn.getAttribute('data-listener-attached')) {
        retryBtn.addEventListener('click', () => {
            errorOverlay.style.display = 'none';
            errorOverlay.classList.add('hidden');
            initializeApp(); // Attempt to re-initialize
        });
        retryBtn.setAttribute('data-listener-attached', 'true');
    }

  } else {
    console.error('App Error:', message, details);
    alert(`Error: ${message}${details ? `\nDetails: ${details}` : ''}`);
  }
}


// --- Script Execution ---
document.addEventListener('DOMContentLoaded', initializeApp);

console.log('app.js loaded. Initialization will run on DOMContentLoaded.');