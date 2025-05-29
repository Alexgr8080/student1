// Global variables (assuming these are defined and managed as per your existing setup)
let adminCurrentUser = null;
let adminUserOrgData = null;
let adminCurrentOrganization = null;
let adminModuleInitialized = false;
let adminSelectedSupervisor = null; // Stores the ID of the supervisor record being edited/viewed
let adminSelectedStudent = null;   // Stores the ID of the student record being edited/viewed
let adminLoadingState = false;

let availableRoles = [];
let availableDepartments = [
    { id: '1', name: 'Computer Science' },
    { id: '2', name: 'Engineering' },
    { id: '3', name: 'Business' },
    { id: '4', name: 'Arts & Humanities' },
    { id: '5', name: 'Sciences' }
];
let availableProgramTemplates = [];
let availableSupervisorsForSelect = []; // Used to populate dropdowns

let adminProjectStatusChartInstance = null;
let adminProgressTrendChartInstance = null;

let eventListenersInitialized = false; // To prevent duplicate event listener setup

// ------------------------------------------------------------------------
// DOM ELEMENT CACHE
// ------------------------------------------------------------------------
const AdminDOM = {
    adminSidebarNav: null,
    navLinks: [],
    pageTitle: null,
    contentContainer: null,
    loadingOverlay: null,
    userNameDisplay: null,
    userAvatar: null,
    portalType: null,
    notificationCountBadge: null,
    // Dashboard Stats
    supervisorCountStat: null,
    newSupervisorsCountStat: null,
    studentCountStat: null,
    newStudentsCountStat: null,
    needsAttentionCountStat: null,
    needsAttentionChangeStat: null,
    meetingsThisWeekStat: null,
    // Charts
    projectStatusChartContainer: null,
    progressTrendChartContainer: null,
    // Supervisor Management
    supervisorTableContainer: null,
    supervisorTableBody: null,
    addSupervisorBtn: null,
    supervisorSearchInput: null,
    supervisorFilterDropdown: null, // Assuming a filter dropdown exists
    supervisorPagination: null,
    // Student Management
    studentTableContainer: null,
    studentTableBody: null,
    addStudentBtn: null,
    studentSearchInput: null,
    studentFilterDropdown: null, // Assuming a filter dropdown exists
    studentPagination: null,
    // Modal Elements
    modalContainer: null,
    modalTitle: null,
    modalBody: null,
    modalFooter: null,
    modalCloseBtn: null, // Header close button
    modalSaveBtn: null,
    // Specific modal elements from admin.html (Tailwind based)
    supervisorModal: null,
    closeSupervisorModalBtn: null,
    cancelSupervisorModalBtn: null,
    supervisorForm: null,
    studentModal: null,
    closeStudentModalBtn: null,
    cancelStudentModalBtn: null,
    studentForm: null,
    programModal: null,
    deleteConfirmModal: null,
    confirmDeleteBtn: null,
    cancelDeleteBtn: null,
    deleteConfirmText: null,

};

// admin.js - Enhanced administrator dashboard module
// Initialize the dashboard when document is ready
document.addEventListener('DOMContentLoaded', () => {
  // Listen for auth module ready event
  // Assuming AuthModuleEventsGlobal is defined elsewhere, or this needs adjustment
  if (typeof AuthModuleEventsGlobal === 'undefined') {
      console.warn('AuthModuleEventsGlobal is not defined. Admin dashboard may not initialize via auth event.');
      // Fallback or direct initialization if needed for standalone testing
      // initializeAdminDashboard(someDefaultUser, someDefaultOrgData); 
  } else {
    window.addEventListener(AuthModuleEventsGlobal.AUTH_MODULE_READY, async (event) => {
        const { user, orgData } = event.detail;
        
        if (user && orgData) {
          await initializeAdminDashboard(user, orgData);
        }
      });
  }
});

/**
 * Initialize the admin dashboard
 */
async function initializeAdminDashboard(user, orgData) {
  if (adminModuleInitialized) {
    return;
  }
  
  try {
    console.log('Initializing admin dashboard...');
    showAdminLoading('Loading dashboard...'); // Uses new loading function
    
    // Store user and org data
    adminCurrentUser = user;
    adminUserOrgData = orgData; // Contains organization and roles
    
    // Get current organization
    adminCurrentOrganization = orgData.organization;
    
    // Check if user has admin role
    // Ensure orgData.roles is an array and has the expected structure
    const isAdmin = orgData.roles && orgData.roles.some(role => role.name === 'admin');
    
    if (!isAdmin) {
      // This error will be caught by the try-catch block
      throw new Error('You do not have permission to access the admin dashboard');
    }
    
    // Ensure getSupabaseClient is available
    if (typeof getSupabaseClient !== 'function') {
        throw new Error('getSupabaseClient function is not available.');
    }
    const supabase = await getSupabaseClient();
    if (!supabase) {
        throw new Error('Supabase client could not be initialized.');
    }
    
    // Load roles for dropdown menus
    await loadAvailableRoles(supabase); // Uses new function
    
    // Load program templates for dropdown menus
    await loadProgramTemplates(supabase); // Uses new function
    
    // Load supervisors for dropdown menus
    await loadSupervisorsForSelect(supabase); // Uses new function
    
    // Cache DOM elements
    cacheAdminDOMElements(); // Uses new (stubbed) function
    
    // Setup event listeners
    setupAdminEventListeners(); // Uses new function
    
    // Load initial data
    await loadDashboardOverview(supabase); // New function
    await loadSupervisorsList(supabase);   // New function
    await loadStudentsList(supabase);     // New function
    
    // Initialize charts
    initializeAdminCharts(); // New function
    
    // Update UI components like username etc. from original file if still needed
    initializeUIComponents(); // Kept from original, uses adminCurrentUser

    adminModuleInitialized = true;
    hideAdminLoading(); // Uses new loading function
    
    console.log('Admin dashboard initialized successfully');
  } catch (error) {
    console.error('Error initializing admin dashboard:', error);
    hideAdminLoading(); // Uses new loading function
    showAdminError(error.message); // Uses new error function
  }
}

/**
 * Load available roles from database
 */
async function loadAvailableRoles(supabase) {
  try {
    if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
        console.warn("Organization context not available for loading roles.");
        availableRoles = [];
        return availableRoles;
    }
    const { data, error } = await supabase
      .from('roles')
      .select('id, name')
      .eq('organization_id', adminCurrentOrganization.id); // Assuming roles are org-specific
    
    if (error) throw error;
    
    availableRoles = data || [];
    console.log(`Admin: Loaded ${availableRoles.length} roles for org ${adminCurrentOrganization.id}.`);
    return availableRoles;
  } catch (error) {
    console.error('Error loading roles:', error);
    availableRoles = []; // Ensure it's empty on error
    // Propagate error to be handled by the caller or a global error handler
    // For instance, display a message to the user via showAdminError
    showAdminError(`Failed to load available roles: ${error.message}`);
    throw error; // Or handle it more gracefully depending on application flow
  }
}

/**
 * Load program templates from database
 */
async function loadProgramTemplates(supabase) {
  try {
    if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
        console.warn("Organization context not available for loading program templates.");
        availableProgramTemplates = [];
        return availableProgramTemplates;
    }
    const { data, error } = await supabase
      .from('program_templates')
      .select('id, name, description, department_id, duration_months') // Added more fields as per snippet
      .eq('organization_id', adminCurrentOrganization.id);
    
    if (error) throw error;
    
    availableProgramTemplates = data || [];
    console.log(`Admin: Loaded ${availableProgramTemplates.length} program templates.`);
    return availableProgramTemplates;
  } catch (error) {
    console.error('Error loading program templates:', error);
    availableProgramTemplates = [];
    showAdminError(`Failed to load program templates: ${error.message}`);
    throw error;
  }
}

/**
 * Load supervisors for dropdown menus
 */
async function loadSupervisorsForSelect(supabase) {
  try {
    if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
        console.warn("Organization context not available for loading supervisors for select.");
        availableSupervisorsForSelect = [];
        return availableSupervisorsForSelect;
    }
    // The query in the snippet was slightly different from the original, using 'profiles:user_id(...)'
    // Assuming 'profiles' is the table name for user profiles linked by 'user_id'.
    // If 'users' is the auth table and 'profiles' is a public table with user details:
    const { data, error } = await supabase
      .from('supervisors')
      .select(`
        id,
        user_id,
        profiles!inner(first_name, last_name), 
        department_id,
        departments!left(name),
        status
      `)
      .eq('organization_id', adminCurrentOrganization.id)
      .eq('status', 'active'); // Only active supervisors for selection
    
    if (error) {
        console.error('Supabase error loading supervisors for select:', error);
        throw error;
    }
    
    availableSupervisorsForSelect = data ? data.map(supervisor => ({
      id: supervisor.id, // This is supervisors.id
      name: `${supervisor.profiles?.first_name || ''} ${supervisor.profiles?.last_name || ''}`.trim() || `User ID: ${supervisor.user_id}`,
      // department: supervisor.departments?.name || 'Unknown department' // from snippet
      // email: supervisor.profiles?.email // if email is in profiles and needed
    })).sort((a,b) => a.name.localeCompare(b.name)) : [];  // Sort client-side after mapping
    
    console.log(`Admin: Loaded ${availableSupervisorsForSelect.length} active supervisors for selection.`);
    return availableSupervisorsForSelect;
  } catch (error) {
    console.error('Error loading supervisors for select:', error);
    availableSupervisorsForSelect = [];
    showAdminError(`Failed to load supervisors for selection lists: ${error.message}`);
    throw error;
  }
}

/**
 * Load dashboard overview data
 */
async function loadDashboardOverview(supabase) {
  try {
    if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
        console.warn("Cannot load dashboard overview without organization ID.");
        return;
    }
    const orgId = adminCurrentOrganization.id;

    // Get counts
    const [
      supervisorsResult,
      studentsResult,
      needsAttentionResult, // This was 'projects' in snippet, assuming 'students' with status 'attention' is more consistent
      meetingsResult
    ] = await Promise.all([
      supabase.from('supervisors').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'needs_attention').eq('organization_id', orgId), // Adjusted from 'projects' to 'students'
      supabase.from('meetings').select('id', { count: 'exact', head: true }) // Assuming meetings are org-specific or filtered elsewhere
        .gte('meeting_date', new Date(Date.now() - 86400000).toISOString()) 
        .lte('meeting_date', new Date(Date.now() + 7 * 86400000).toISOString())
        .eq('organization_id', orgId) // Added org filter
    ]);
    
    // Check for errors
    if (supervisorsResult.error) throw supervisorsResult.error;
    if (studentsResult.error) throw studentsResult.error;
    if (needsAttentionResult.error) throw needsAttentionResult.error;
    if (meetingsResult.error) throw meetingsResult.error;
    
    // Update dashboard UI with counts
    updateDashboardOverviewUI({
      supervisorsCount: supervisorsResult.count || 0,
      studentsCount: studentsResult.count || 0,
      needsAttentionCount: needsAttentionResult.count || 0,
      meetingsCount: meetingsResult.count || 0
    });
    
  } catch (error) {
    console.error('Error loading dashboard overview:', error);
    showAdminError(`Failed to load dashboard overview: ${error.message}`);
    // throw error; // Decide if this should halt further execution or allow partial dashboard load
  }
}

/**
 * Update dashboard overview UI with counts
 */
function updateDashboardOverviewUI(data) {
  // Update supervisor count (using original AdminDOM IDs if they match, otherwise direct getElementById)
  const supervisorsCountElement = document.getElementById('supervisorCount') || document.getElementById('supervisors-count');
  if (supervisorsCountElement) {
    supervisorsCountElement.textContent = data.supervisorsCount;
  }
  
  const studentsCountElement = document.getElementById('studentCount') || document.getElementById('students-count');
  if (studentsCountElement) {
    studentsCountElement.textContent = data.studentsCount;
  }
  
  const needsAttentionElement = document.getElementById('attentionCount') || document.getElementById('needs-attention-count');
  if (needsAttentionElement) {
    needsAttentionElement.textContent = data.needsAttentionCount;
  }
  
  const meetingsCountElement = document.getElementById('meetingsCount') || document.getElementById('meetings-count');
  if (meetingsCountElement) {
    meetingsCountElement.textContent = data.meetingsCount;
  }
}

/**
 * Load supervisors list
 */
async function loadSupervisorsList(supabase) {
  try {
    if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
        console.warn("Cannot load supervisors list without organization ID.");
        return [];
    }
    // The snippet used 'profiles:user_id(...)' for Supabase relation.
    // Assuming 'profiles' table is linked to 'supervisors.user_id' which is a FK to 'auth.users.id'
    // and 'profiles' has a 'user_id' column that matches 'auth.users.id'.
    // The syntax `profiles:user_id(first_name, last_name, email)` implies `user_id` is the FK column in `supervisors`
    // that points to `profiles.id` (if `profiles` has its own `id` and `user_id` is different).
    // More typically, it would be `supervisors(..., user_id(first_name, last_name, email))` if `user_id` links to `auth.users`
    // and `profiles` is joined via `user_id`.
    // Let's adjust to a common pattern: supervisors -> users (auth) -> profiles (public)
    // Or, if 'profiles' is directly linked from 'supervisors.user_id'
    const { data, error } = await supabase
      .from('supervisors')
      .select(`
        id,
        user_id,
        faculty_id,
        department_id,
        status, 
        title, 
        roles, 
        users:user_id (email, raw_user_meta_data), 
        departments:department_id (name)
      `)
      .eq('organization_id', adminCurrentOrganization.id)
      .order('users(raw_user_meta_data->>last_name)', { ascending: true }); // Adjust based on actual metadata structure
    
    if (error) throw error;
    
    // Enrich with student counts (adapted from snippet)
    await enrichSupervisorsWithStudentCounts(supabase, data || []);
    
    renderSupervisorsList(data || []);
    return data || [];
  } catch (error) {
    console.error('Error loading supervisors list:', error);
    showAdminError(`Failed to load supervisors list: ${error.message}`);
    // Render an error message in the table
    const supervisorsTableBody = document.getElementById('supervisorTableBody') || document.getElementById('supervisors-table-body');
    if (supervisorsTableBody) supervisorsTableBody.innerHTML = `<tr><td colspan="7">Error loading supervisors.</td></tr>`;
    throw error;
  }
}

/**
 * Enrich supervisors data with student counts
 */
async function enrichSupervisorsWithStudentCounts(supabase, supervisors) {
  try {
    if (!supervisors || supervisors.length === 0) return supervisors;
    if (!adminCurrentOrganization || !adminCurrentOrganization.id) return supervisors;

    // Get all student_supervisors links for the organization to count
    // This assumes a linking table 'student_supervisors'
    const { data: links, error } = await supabase
      .from('student_supervisors') // Assuming this table links students to supervisors
      .select('supervisor_id')
      // .eq('organization_id', adminCurrentOrganization.id); // If org_id is in student_supervisors
      // If not, we might need to filter by students of the org, then their supervisors

    if (error) {
        console.warn('Could not load student_supervisor links for counts:', error.message);
        supervisors.forEach(s => s.studentCount = 'N/A'); // Default if count fails
        return supervisors;
    }
    
    const studentCounts = (links || []).reduce((counts, link) => {
      if (link.supervisor_id) {
        counts[link.supervisor_id] = (counts[link.supervisor_id] || 0) + 1;
      }
      return counts;
    }, {});
    
    supervisors.forEach(supervisor => {
      supervisor.studentCount = studentCounts[supervisor.id] || 0;
    });
    
    return supervisors;
  } catch (error) {
    console.error('Error enriching supervisors with student counts:', error);
    // Don't let this break the main load, just default counts
    supervisors.forEach(s => s.studentCount = 'N/A');
    showAdminError(`Could not accurately count students for supervisors: ${error.message}`);
    return supervisors; // Return original supervisors array
  }
}

/**
 * Render supervisors list
 */
function renderSupervisorsList(supervisors) {
  const supervisorsTableBody = document.getElementById('supervisorTableBody') || document.getElementById('supervisors-table-body');
  if (!supervisorsTableBody) return;
  
  supervisorsTableBody.innerHTML = ''; // Clear existing content
  
  if (!supervisors || supervisors.length === 0) {
    supervisorsTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">No supervisors found</td></tr>`;
    return;
  }
  
  supervisors.forEach(supervisor => {
    const tr = document.createElement('tr');
    // Adjust access to name and email based on the actual structure of 'supervisor.users' (raw_user_meta_data or profiles)
    const profile = supervisor.users?.raw_user_meta_data;
    const fullName = `${profile?.first_name || profile?.full_name || ''} ${profile?.last_name || ''}`.trim() || supervisor.users?.email || 'N/A';
    const email = supervisor.users?.email || 'N/A';
    const facultyId = supervisor.faculty_id || profile?.faculty_id || 'N/A';
    
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
              <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900">${fullName}</div>
                  <div class="text-sm text-gray-500">Faculty ID: ${facultyId}</div>
              </div>
          </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${email}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${supervisor.departments?.name || 'N/A'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatRoles(supervisor.roles)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${supervisor.studentCount}</td>
      <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${supervisor.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
              ${capitalize(supervisor.status || 'N/A')}
          </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium actions-cell">
        <button class="text-blue-600 hover:text-blue-900 mr-2 action-btn edit-btn" data-id="${supervisor.id}" title="Edit Supervisor"><i class="fas fa-edit"></i> Edit</button>
        ${supervisor.status === 'active' ? 
          `<button class="text-red-600 hover:text-red-900 action-btn suspend-btn" data-id="${supervisor.id}" title="Suspend Supervisor"><i class="fas fa-user-slash"></i> Suspend</button>` :
          `<button class="text-green-600 hover:text-green-900 action-btn activate-btn" data-id="${supervisor.id}" title="Activate Supervisor"><i class="fas fa-user-check"></i> Activate</button>`
        }
      </td>
    `;
    
    // Add event listeners (ensure FontAwesome icons are loaded if using them)
    const editBtn = tr.querySelector('.edit-btn');
    // const viewBtn = tr.querySelector('.view-btn'); // View button not in current snippet logic
    const suspendBtn = tr.querySelector('.suspend-btn');
    const activateBtn = tr.querySelector('.activate-btn');
    
    if (editBtn) { editBtn.addEventListener('click', () => openEditSupervisorModal(supervisor.id)); }
    // if (viewBtn) { viewBtn.addEventListener('click', () => openSupervisorDetailsModal(supervisor.id)); } // Function not provided
    if (suspendBtn) { suspendBtn.addEventListener('click', () => updateSupervisorStatus(supervisor.id, 'suspended')); }
    if (activateBtn) { activateBtn.addEventListener('click', () => updateSupervisorStatus(supervisor.id, 'active')); }
    
    supervisorsTableBody.appendChild(tr);
  });
}

/**
 * Load students list
 */
async function loadStudentsList(supabase) {
  try {
    if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
        console.warn("Cannot load students list without organization ID.");
        return [];
    }
    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        user_id,
        student_id, 
        program_id,
        department_id,
        supervisor_id,
        enrollment_date,
        expected_completion_date,
        status,
        users:user_id (email, raw_user_meta_data), 
        programs:program_id (name),
        departments:department_id (name),
        student_supervisors!left(supervisors!left(id, users:user_id(raw_user_meta_data))) 
      `)
      .eq('organization_id', adminCurrentOrganization.id)
      .order('users(raw_user_meta_data->>last_name)', { ascending: true }) // Adjust based on metadata
      .limit(50); 
    
    if (error) throw error;
    
    renderStudentsList(data || []);
    return data || [];
  } catch (error) {
    console.error('Error loading students list:', error);
    showAdminError(`Failed to load students list: ${error.message}`);
    const studentsTableBody = document.getElementById('studentTableBody') || document.getElementById('students-table-body');
    if (studentsTableBody) studentsTableBody.innerHTML = `<tr><td colspan="8">Error loading students.</td></tr>`;
    throw error;
  }
}

/**
 * Render students list
 */
function renderStudentsList(students) {
  const studentsTableBody = document.getElementById('studentTableBody') || document.getElementById('students-table-body');
  if (!studentsTableBody) return;
  
  studentsTableBody.innerHTML = '';
  
  if (!students || students.length === 0) {
    studentsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">No students found</td></tr>`;
    return;
  }
  
  students.forEach(student => {
    const tr = document.createElement('tr');
    const profile = student.users?.raw_user_meta_data;
    const fullName = `${profile?.first_name || profile?.full_name || ''} ${profile?.last_name || ''}`.trim() || student.users?.email || 'N/A';
    const email = student.users?.email || 'N/A';
    const studentIdNumber = student.student_id || profile?.student_id_number || 'N/A';
    
    let supervisorName = 'Not assigned';
    if (student.student_supervisors && student.student_supervisors.length > 0 && student.student_supervisors[0].supervisors) {
        const supProfile = student.student_supervisors[0].supervisors.users?.raw_user_meta_data;
        supervisorName = `${supProfile?.first_name || supProfile?.full_name || ''} ${supProfile?.last_name || ''}`.trim() || 'N/A';
    } else if (student.supervisor_id && availableSupervisorsForSelect.length > 0) { // Fallback if direct supervisor_id is present
        const assignedSup = availableSupervisorsForSelect.find(s => s.id === student.supervisor_id);
        if(assignedSup) supervisorName = assignedSup.name;
    }


    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
              <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900">${fullName}</div>
                  <div class="text-sm text-gray-500">Student ID: ${studentIdNumber}</div>
              </div>
          </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${email}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.departments?.name || 'N/A'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.programs?.name || 'N/A'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${supervisorName}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(student.enrollment_date)} to ${formatDate(student.expected_completion_date)}</td>
      <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            student.status === 'active' ? 'bg-green-100 text-green-800' : 
            (student.status === 'needs_attention' || student.status === 'at_risk' ? 'bg-yellow-100 text-yellow-800' : 
            (student.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'))
          }">
              ${capitalize(student.status || 'N/A')}
          </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium actions-cell">
        <button class="text-blue-600 hover:text-blue-900 mr-2 action-btn edit-btn" data-id="${student.id}" title="Edit Student"><i class="fas fa-edit"></i> Edit</button>
        ${student.status === 'active' ? 
          `<button class="text-red-600 hover:text-red-900 action-btn suspend-btn" data-id="${student.id}" title="Suspend Student"><i class="fas fa-user-slash"></i> Suspend</button>` :
          `<button class="text-green-600 hover:text-green-900 action-btn activate-btn" data-id="${student.id}" title="Activate Student"><i class="fas fa-user-check"></i> Activate</button>`
        }
      </td>
    `;
    
    const editBtn = tr.querySelector('.edit-btn');
    // const viewBtn = tr.querySelector('.view-btn'); // Function openStudentDetailsModal not provided
    const suspendBtn = tr.querySelector('.suspend-btn');
    const activateBtn = tr.querySelector('.activate-btn');
    
    if (editBtn) { editBtn.addEventListener('click', () => openEditStudentModal(student.id)); }
    // if (viewBtn) { viewBtn.addEventListener('click', () => openStudentDetailsModal(student.id)); } // Function not provided
    if (suspendBtn) { suspendBtn.addEventListener('click', () => updateStudentStatus(student.id, 'suspended'));}
    if (activateBtn) { activateBtn.addEventListener('click', () => updateStudentStatus(student.id, 'active'));}
    
    studentsTableBody.appendChild(tr);
  });
}

/**
 * Initialize admin dashboard charts
 */
function initializeAdminCharts() {
  initializeProjectStatusChart();
  initializeStudentProgressChart(); // Renamed from snippet's "student-progress-chart" for consistency
}

/**
 * Initialize project status distribution chart
 */
async function initializeProjectStatusChart() {
  try {
    const chartCanvas = document.getElementById('projectStatusChart') || document.getElementById('project-status-chart');
    if (!chartCanvas) return;
    
    const supabase = await getSupabaseClient();
    // Assuming 'projects' table and status as per snippet, or adapt to 'students' table status
    const { data, error } = await supabase
      .from('students') // Changed from 'projects' to 'students' for consistency with other dashboard items
      .select('status')
      .eq('organization_id', adminCurrentOrganization.id);
    
    if (error) throw error;
    
    const statusCounts = (data || []).reduce((counts, item) => {
      const status = item.status || 'other';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    
    const labels = Object.keys(statusCounts).map(status => capitalize(status));
    const values = Object.values(statusCounts);
    const backgroundColors = ['#10B981', '#FBBF24', '#EF4444', '#6366F1', '#9CA3AF', '#F87171', '#A78BFA']; // Added more colors
    
    if (adminProjectStatusChartInstance) { adminProjectStatusChartInstance.destroy(); }
    
    adminProjectStatusChartInstance = new Chart(chartCanvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: backgroundColors.slice(0, values.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right' }, title: { display: true, text: 'Student Status Distribution' } }
      }
    });
  } catch (error) {
    console.error('Error initializing project status chart:', error);
    const chartCanvas = document.getElementById('projectStatusChart') || document.getElementById('project-status-chart');
    if(chartCanvas && chartCanvas.parentElement) chartCanvas.parentElement.innerHTML = '<div class="chart-error p-4 text-red-500">Failed to load status chart.</div>';
    showAdminError(`Failed to load status distribution chart: ${error.message}`);
  }
}

/**
 * Initialize student progress trends chart
 */
async function initializeStudentProgressChart() {
  try {
    const chartCanvas = document.getElementById('progressTrendsChart') || document.getElementById('student-progress-chart');
    if (!chartCanvas) return;
    
    const supabase = await getSupabaseClient();
    // This requires a 'progress' field and 'updated_at' on the 'students' or 'projects' table.
    // The snippet used 'projects', let's assume it's 'students' for now.
    const { data, error } = await supabase
      .from('students') // Assuming progress is tracked for students directly or via a linked projects table
      .select('progress, updated_at') // 'progress' field needs to exist
      .eq('organization_id', adminCurrentOrganization.id)
      .order('updated_at', { ascending: false })
      .limit(100); 
    
    if (error) throw error;
    
    const monthlyProgress = {};
    (data || []).forEach(item => {
      if (item.updated_at && typeof item.progress === 'number') {
        const date = new Date(item.updated_at);
        const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
        if (!monthlyProgress[monthYear]) { monthlyProgress[monthYear] = { total: 0, count: 0 }; }
        monthlyProgress[monthYear].total += item.progress;
        monthlyProgress[monthYear].count += 1;
      }
    });
    
    // Sort months chronologically - Object.keys doesn't guarantee order
    const sortedMonthYears = Object.keys(monthlyProgress).sort((a,b) => new Date(a) - new Date(b));

    const monthLabels = [];
    const progressData = [];
    
    sortedMonthYears.forEach(month => {
      monthLabels.push(month);
      progressData.push(monthlyProgress[month].total / monthlyProgress[month].count);
    });
    
    if (adminProgressTrendChartInstance) { adminProgressTrendChartInstance.destroy(); }
    
    adminProgressTrendChartInstance = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Average Progress', data: progressData, fill: false,
          borderColor: 'rgb(75, 192, 192)', tension: 0.1
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Student Progress Trends' } },
        scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Progress (%)' } },
                  x: { title: { display: true, text: 'Month/Year' } } }
      }
    });
  } catch (error) {
    console.error('Error initializing student progress chart:', error);
    const chartCanvas = document.getElementById('progressTrendsChart') || document.getElementById('student-progress-chart');
     if(chartCanvas && chartCanvas.parentElement) chartCanvas.parentElement.innerHTML = '<div class="chart-error p-4 text-red-500">Failed to load progress trends.</div>';
    showAdminError(`Failed to load progress trend chart: ${error.message}`);
  }
}

/**
 * Open modal to edit supervisor. Assumes modal HTML structure exists.
 */
async function openEditSupervisorModal(supervisorId) {
  try {
    adminSelectedSupervisor = supervisorId; // Store ID of supervisor being edited
    
    const supabase = await getSupabaseClient();
    // Fetch supervisor details and related user profile
    const { data, error } = await supabase
      .from('supervisors')
      .select(`*, users:user_id (email, raw_user_meta_data)`) // Assuming raw_user_meta_data has first_name, last_name
      .eq('id', supervisorId)
      .eq('organization_id', adminCurrentOrganization.id) // Ensure correct org
      .single();
    
    if (error || !data) throw error || new Error('Supervisor not found.');
    
    // Fetch supervisor's roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', data.user_id)
      .eq('organization_id', adminCurrentOrganization.id);
    if (rolesError) throw rolesError;
    const supervisorRoleIds = userRoles.map(ur => ur.role_id.toString()); // Ensure string for comparison with checkbox value

    const modalContainer = document.getElementById('supervisorModal') || document.getElementById('edit-supervisor-modal-container');
    if (!modalContainer) { showAdminError("Edit supervisor modal not found."); return; }
    const form = modalContainer.querySelector('form'); // e.g. document.getElementById('supervisorForm')
    if (!form) { showAdminError("Edit supervisor form not found."); return; }

    // Populate form fields (adjust IDs to match your actual modal HTML)
    // Example IDs: supervisor-first-name, supervisor-last-name, supervisor-email, etc.
    const profile = data.users?.raw_user_meta_data || {};
    form.querySelector('#supervisorName').value = profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    form.querySelector('#supervisorEmail').value = data.users?.email || '';
    form.querySelector('#supervisorEmail').disabled = true; // Usually email isn't changed here
    form.querySelector('#supervisorFacultyId').value = data.faculty_id || profile.faculty_id || '';
    form.querySelector('#supervisorDeptSelect').value = data.department_id || ''; // Assumes department select is populated
    // form.querySelector('#supervisor-title').value = data.title || ''; // 'title' was in snippet but not original form
    
    // For roles, assuming checkboxes like <input type="checkbox" name="roles" value="role_id_X">
    const roleCheckboxes = form.querySelectorAll('input[name="supervisorRoles"]'); // Adjust name selector
    if (roleCheckboxes.length > 0) {
        roleCheckboxes.forEach(checkbox => {
            checkbox.checked = supervisorRoleIds.includes(checkbox.value);
        });
    } else { // Fallback for a single role select
        const roleSelect = form.querySelector('#supervisorRole'); // If using a single role select
        if (roleSelect && supervisorRoleIds.length > 0) {
            roleSelect.value = supervisorRoleIds[0]; // Assign first role, or adapt for multi-select
        }
    }
    // Store supervisorId in the form if not already there (e.g., hidden input)
    let idInput = form.querySelector('#supervisorId');
    if(!idInput) {
      idInput = document.createElement('input');
      idInput.type = 'hidden';
      idInput.id = 'supervisorId';
      idInput.name = 'supervisorId';
      form.appendChild(idInput);
    }
    idInput.value = supervisorId;


    modalContainer.classList.remove('hidden'); // Show modal (Tailwind)
    // Or modalContainer.style.display = 'flex'; for snippet's style

  } catch (error) {
    console.error('Error opening edit supervisor modal:', error);
    showAdminError(`Failed to load supervisor details: ${error.message}`);
  }
}

/**
 * Save supervisor changes from the modal form.
 */
async function saveSupervisorChanges(formData) { // formData is an object of form values
  try {
    if (!adminSelectedSupervisor) throw new Error('No supervisor selected for update.');
    showAdminLoading('Saving supervisor changes...');
    const supabase = await getSupabaseClient();

    // Get current supervisor's user_id
    const { data: currentSupervisor, error: fetchError } = await supabase
      .from('supervisors').select('user_id').eq('id', adminSelectedSupervisor).single();
    if (fetchError || !currentSupervisor) throw fetchError || new Error("Original supervisor record not found.");
    const userId = currentSupervisor.user_id;

    // 1. Update auth.users user_metadata (if names, etc. are there)
    const userMetadataUpdates = {};
    if (formData.firstName && formData.lastName) userMetadataUpdates.full_name = `${formData.firstName} ${formData.lastName}`;
    else if (formData.fullName) userMetadataUpdates.full_name = formData.fullName; // if form gives fullName
    if (formData.facultyId) userMetadataUpdates.faculty_id = formData.facultyId;
    // Add other metadata fields if necessary

    if (Object.keys(userMetadataUpdates).length > 0) {
        const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, { user_metadata: userMetadataUpdates });
        if (authUpdateError) throw new Error(`Auth update error: ${authUpdateError.message}`);
    }
    
    // 2. Update 'supervisors' table
    const supervisorRecordUpdates = {
      department_id: formData.departmentId,
      faculty_id: formData.facultyId, // Also store in supervisors table if needed for direct queries
      // title: formData.title, // if title field exists
      status: formData.status || 'active', // Ensure status is part of formData or defaults
      updated_at: new Date().toISOString()
    };
    const { error: supervisorUpdateError } = await supabase
      .from('supervisors').update(supervisorRecordUpdates).eq('id', adminSelectedSupervisor);
    if (supervisorUpdateError) throw new Error(`Supervisor table update error: ${supervisorUpdateError.message}`);

    // 3. Update roles in 'user_roles' table
    if (formData.roles && Array.isArray(formData.roles)) { // Assuming formData.roles is an array of role IDs
      // Delete existing roles for this user in this org
      await supabase.from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('organization_id', adminCurrentOrganization.id);
      // Insert new roles
      const newRolesToInsert = formData.roles.map(roleId => ({
        user_id: userId,
        role_id: roleId,
        organization_id: adminCurrentOrganization.id
      }));
      if (newRolesToInsert.length > 0) {
        const { error: rolesInsertError } = await supabase.from('user_roles').insert(newRolesToInsert);
        if (rolesInsertError) throw new Error(`User roles update error: ${rolesInsertError.message}`);
      }
    }
    
    hideAdminLoading();
    showAdminSuccess('Supervisor updated successfully!');
    await loadSupervisorsList(supabase); // Refresh list
    closeModal(document.getElementById('supervisorModal')?.id || 'edit-supervisor-modal-container'); // Close modal

  } catch (error) {
    console.error('Error saving supervisor changes:', error);
    hideAdminLoading();
    showAdminError(`Failed to save supervisor: ${error.message}`);
  }
}

/**
 * Cache admin DOM elements (Stub from new code)
 */
function cacheAdminDOMElements() {
  // This is a stub from the new code.
  // The original `AdminDOM` object is defined above.
  // If new code relies on `AdminDOM` properties, this function would need to be filled
  // similar to the original `cacheAdminDOMElements`, or AdminDOM usage needs to be refactored.
  // For now, existing AdminDOM object remains, but this function doesn't populate it further.
  console.log("Admin: cacheAdminDOMElements (new stub) called.");
}

/**
 * Setup admin dashboard event listeners (New version)
 */
function setupAdminEventListeners() {
  const addSupervisorBtn = document.getElementById('addSupervisorBtn') || document.getElementById('add-supervisor-btn');
  if (addSupervisorBtn) addSupervisorBtn.addEventListener('click', openAddSupervisorModal);
  
  const addStudentBtn = document.getElementById('addStudentBtn') || document.getElementById('add-student-btn');
  if (addStudentBtn) addStudentBtn.addEventListener('click', openAddStudentModal);
  
  // Modal close buttons (generic class based)
  document.querySelectorAll('.close-modal-btn').forEach(button => { // Assuming modals have a common close button class
    button.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-container, .modal'); // Adjust selector for your modal structure
      if (modal) closeModal(modal.id);
    });
  });
  
  // Form Submissions (Ensure form IDs match your HTML)
  const supervisorForm = document.getElementById('supervisorForm'); // From original AdminDOM
  if (supervisorForm) supervisorForm.addEventListener('submit', handleEditSupervisorSubmit); // Or a more generic save

  const studentForm = document.getElementById('studentForm'); // From original AdminDOM
  if (studentForm) studentForm.addEventListener('submit', handleEditStudentSubmit); // Or a more generic save

  // Specific modal forms if they have different IDs:
  // const addSupervisorForm = document.getElementById('add-supervisor-form');
  // if (addSupervisorForm) addSupervisorForm.addEventListener('submit', handleAddSupervisorSubmit);
  // const addStudentForm = document.getElementById('add-student-form');
  // if (addStudentForm) addStudentForm.addEventListener('submit', handleAddStudentSubmit);

  // Example for Tailwind modals from original HTML structure
  AdminDOM.closeSupervisorModalBtn?.addEventListener('click', () => closeModal('supervisorModal'));
  AdminDOM.cancelSupervisorModalBtn?.addEventListener('click', () => closeModal('supervisorModal'));

  AdminDOM.closeStudentModalBtn?.addEventListener('click', () => closeModal('studentModal'));
  AdminDOM.cancelStudentModalBtn?.addEventListener('click', () => closeModal('studentModal'));
  
  console.log("Admin: setupAdminEventListeners (new) completed.");
}

/**
 * Show loading indicator for admin (New version)
 */
function showAdminLoading(message = 'Loading...') {
  adminLoadingState = true;
  let loadingElement = document.getElementById('admin-loading-indicator');
  if (!loadingElement) {
    loadingElement = document.createElement('div');
    loadingElement.id = 'admin-loading-indicator';
    // Basic styling, assuming CSS will handle the class 'loading-indicator'
    loadingElement.className = 'fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-[10000] text-white';
    loadingElement.innerHTML = `
      <div class="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <div class="loading-message text-lg">${message}</div>
      </div>`;
    document.body.appendChild(loadingElement);
  } else {
    loadingElement.querySelector('.loading-message').textContent = message;
    loadingElement.style.display = 'flex';
  }
}

/**
 * Hide admin loading indicator (New version)
 */
function hideAdminLoading() {
  adminLoadingState = false;
  const loadingElement = document.getElementById('admin-loading-indicator');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
}

/**
 * Show admin error message (New version)
 */
function showAdminError(message) {
  // Using the original showToast for consistency, can be adapted
  showToast(message, 'error');
  console.error("Admin Error:", message);
}

/**
 * Show admin success message (New version)
 */
function showAdminSuccess(message) {
  showToast(message, 'success');
  console.log("Admin Success:", message);
}

/**
 * Close a modal by ID (New version)
 */
function closeModal(modalId) {
  if(!modalId) { // If called without ID, try to close known modals
    AdminDOM.supervisorModal?.classList.add('hidden');
    AdminDOM.studentModal?.classList.add('hidden');
    AdminDOM.deleteConfirmModal?.classList.add('hidden');
    // Add any other specific modal IDs here
    return;
  }
  const modalContainer = document.getElementById(modalId);
  if (modalContainer) {
    modalContainer.classList.add('hidden'); // For Tailwind
    // modalContainer.style.display = 'none'; // For direct style manipulation
  }
}

/**
 * Format roles array for display (New version)
 */
function formatRoles(rolesArray) {
  if (!rolesArray || !Array.isArray(rolesArray) || rolesArray.length === 0) {
    return 'N/A';
  }
  return rolesArray.map(role => capitalize(typeof role === 'object' ? role.name : role)).join(', ');
}

/**
 * Format date string for display (New version)
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A'; // Invalid date
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return 'N/A';
  }
}

/**
 * Capitalize first letter of a string and replace underscores (New version)
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

/**
 * Handle edit supervisor form submission.
 * This function should be called by the submit event listener of the supervisor edit form.
 */
async function handleEditSupervisorSubmit(event) {
  event.preventDefault();
  const form = event.target;
  // Extract data from form, matching the structure expected by saveSupervisorChanges
  const formData = {
    // Ensure these IDs match your form inputs
    fullName: form.querySelector('#supervisorName')?.value.trim(), // Or reconstruct from first/last name if separate
    // firstName: form.querySelector('#supervisor-first-name').value.trim(),
    // lastName: form.querySelector('#supervisor-last-name').value.trim(),
    facultyId: form.querySelector('#supervisorFacultyId')?.value.trim(),
    departmentId: form.querySelector('#supervisorDeptSelect')?.value,
    // title: form.querySelector('#supervisor-title').value.trim(), // if you have a title field
    status: form.querySelector('#supervisorStatusSelect')?.value, // if status can be edited
    roles: Array.from(form.querySelectorAll('input[name="supervisorRoles"]:checked')).map(cb => cb.value) // adjust name
  };
  // adminSelectedSupervisor should be set when modal is opened
  if (!adminSelectedSupervisor) {
      showAdminError("No supervisor selected for update. Please re-open the edit form.");
      return;
  }
  await saveSupervisorChanges(formData); // This function needs adminSelectedSupervisor to be set
}

/**
 * Open modal to add a new supervisor.
 */
function openAddSupervisorModal() {
  adminSelectedSupervisor = null; // Clear selection, it's an add operation
  const modalContainer = document.getElementById('supervisorModal') || document.getElementById('add-supervisor-modal-container');
  if (!modalContainer) { showAdminError("Add supervisor modal not found."); return; }
  const form = modalContainer.querySelector('form'); // e.g. document.getElementById('supervisorForm')
  if (form) {
    form.reset(); // Clear previous data
    form.querySelector('#supervisorEmail').disabled = false; // Enable email for new user
    // Ensure hidden supervisorId input is cleared or not used for add mode
    const idInput = form.querySelector('#supervisorId');
    if (idInput) idInput.value = '';
  }
  // Update modal title if it's generic
  const modalTitle = modalContainer.querySelector('.modal-title') || modalContainer.querySelector('#supervisorModalTitle');
  if(modalTitle) modalTitle.textContent = 'Add New Supervisor';

  // Populate department select if not already populated (using original utility)
  const deptSelect = form.querySelector('#supervisorDeptSelect');
  if(deptSelect && availableDepartments) populateSelectWithOptions(deptSelect, availableDepartments, "Select Department", "id", "name");
  // Populate role checkboxes/select (using availableRoles)
  // ... add logic to populate roles ...

  modalContainer.classList.remove('hidden');
}

/**
 * Handle add supervisor form submission.
 */
async function handleAddSupervisorSubmit(event) {
  event.preventDefault();
  const form = event.target; // Assuming this event is on the correct form
  
  const fullName = form.querySelector('#supervisorName')?.value.trim(); // Or first/last name
  const email = form.querySelector('#supervisorEmail')?.value.trim();
  const password = form.querySelector('#supervisorPassword')?.value; // For new user creation
  const facultyId = form.querySelector('#supervisorFacultyId')?.value.trim();
  const departmentId = form.querySelector('#supervisorDeptSelect')?.value;
  const selectedRoles = Array.from(form.querySelectorAll('input[name="supervisorRoles"]:checked')).map(cb => cb.value); // Adjust name

  if (!fullName || !email || !password) {
    showAdminError('Full Name, Email, and Password are required for new supervisors.');
    return;
  }
  
  try {
    showAdminLoading('Creating new supervisor...');
    const supabase = await getSupabaseClient();
    
    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Or false then send invite
      user_metadata: { full_name: fullName, faculty_id: facultyId, organization_id: adminCurrentOrganization.id }
    });
    if (authError) throw new Error(`Auth creation error: ${authError.message}`);
    const userId = authData.user.id;

    // 2. Create Supervisor Profile in 'supervisors' table
    const { data: supervisorData, error: supervisorError } = await supabase
      .from('supervisors')
      .insert({
        user_id: userId,
        organization_id: adminCurrentOrganization.id,
        department_id: departmentId,
        faculty_id: facultyId, // Storing faculty_id here too if needed
        status: 'active', // Default status
        // roles: selectedRoles, // If roles are stored as an array column in supervisors table
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select().single();
    if (supervisorError) throw new Error(`Supervisor profile creation error: ${supervisorError.message}`);

    // 3. Assign roles in 'user_roles' table
    if (selectedRoles.length > 0) {
      const rolesToInsert = selectedRoles.map(roleId => ({
        user_id: userId,
        role_id: roleId,
        organization_id: adminCurrentOrganization.id
      }));
      const { error: rolesError } = await supabase.from('user_roles').insert(rolesToInsert);
      if (rolesError) console.warn('Could not assign roles to new supervisor:', rolesError.message); // Non-critical?
    }
    
    hideAdminLoading();
    showAdminSuccess('Supervisor created successfully!');
    await loadSupervisorsList(supabase); // Refresh table
    await loadSupervisorsForSelect(supabase); // Refresh dropdowns
    closeModal(form.closest('.modal-container, .modal')?.id); // Close the modal

  } catch (error) {
    console.error('Error creating supervisor:', error);
    hideAdminLoading();
    showAdminError(`Failed to create supervisor: ${error.message}`);
  }
}

/**
 * Update supervisor status (active/suspended)
 */
async function updateSupervisorStatus(supervisorId, newStatus) {
  try {
    if (!confirm(`Are you sure you want to ${newStatus === 'active' ? 'activate' : 'suspend'} this supervisor?`)) return;
    showAdminLoading(`${capitalize(newStatus)} supervisor...`);
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('supervisors')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', supervisorId);
    if (error) throw error;
    
    hideAdminLoading();
    showAdminSuccess(`Supervisor ${newStatus}d successfully.`);
    await loadSupervisorsList(supabase); // Refresh list
  } catch (error) {
    console.error(`Error ${newStatus}ing supervisor:`, error);
    hideAdminLoading();
    showAdminError(`Failed to update supervisor status: ${error.message}`);
  }
}

/**
 * Open modal to edit student.
 */
async function openEditStudentModal(studentId) {
  try {
    adminSelectedStudent = studentId; // Store ID of student being edited
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('students')
      .select(`*, users:user_id (email, raw_user_meta_data), student_supervisors!left(supervisor_id)`)
      .eq('id', studentId)
      .eq('organization_id', adminCurrentOrganization.id)
      .single();
    if (error || !data) throw error || new Error('Student not found.');

    const modalContainer = document.getElementById('studentModal') || document.getElementById('edit-student-modal-container');
    if (!modalContainer) { showAdminError("Edit student modal not found."); return; }
    const form = modalContainer.querySelector('form'); // e.g. document.getElementById('studentForm')
    if (!form) { showAdminError("Edit student form not found."); return; }

    const profile = data.users?.raw_user_meta_data || {};
    form.querySelector('#studentName').value = profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    form.querySelector('#studentEmail').value = data.users?.email || '';
    form.querySelector('#studentEmail').disabled = true;
    form.querySelector('#studentIdInput').value = data.student_id || profile.student_id_number || '';
    form.querySelector('#studentDeptSelect').value = data.department_id || profile.department_id || '';
    form.querySelector('#studentProgSelect').value = data.program_template_id || data.program_id || ''; // program_template_id preferred
    form.querySelector('#studentEnrollDate').value = data.enrollment_date ? new Date(data.enrollment_date).toISOString().split('T')[0] : '';
    form.querySelector('#studentStatusSelect').value = data.status || 'active';
    // form.querySelector('#student-expected-completion').value = data.expected_completion_date ? new Date(data.expected_completion_date).toISOString().split('T')[0] : '';
    
    // Supervisor selection
    const supervisorSelect = form.querySelector('#studentSupervisorSelect');
    if (supervisorSelect) {
        populateSelectWithOptions(supervisorSelect, availableSupervisorsForSelect, "Select Supervisor", "id", "name");
        if (data.student_supervisors && data.student_supervisors.length > 0) {
            supervisorSelect.value = data.student_supervisors[0].supervisor_id;
        } else if (data.supervisor_id) { // Fallback to direct student.supervisor_id
             supervisorSelect.value = data.supervisor_id;
        } else {
            supervisorSelect.value = '';
        }
    }
    
    let idInput = form.querySelector('#studentId'); // Hidden input for student's own DB ID
    if(!idInput) {
      idInput = document.createElement('input');
      idInput.type = 'hidden';
      idInput.id = 'studentId';
      idInput.name = 'studentId';
      form.appendChild(idInput);
    }
    idInput.value = studentId;


    // Update modal title if generic
    const modalTitle = modalContainer.querySelector('.modal-title') || modalContainer.querySelector('#studentModalTitle');
    if(modalTitle) modalTitle.textContent = 'Edit Student';
    
    modalContainer.classList.remove('hidden');

  } catch (error) {
    console.error('Error opening edit student modal:', error);
    showAdminError(`Failed to load student details: ${error.message}`);
  }
}

/**
 * Handle edit student form submission.
 */
async function handleEditStudentSubmit(event) {
  event.preventDefault();
  const form = event.target;
  if (!adminSelectedStudent) { showAdminError("No student selected."); return; }

  const formData = {
    fullName: form.querySelector('#studentName')?.value.trim(),
    studentIdNumber: form.querySelector('#studentIdInput')?.value.trim(), // This is the student's ID number, not DB ID
    departmentId: form.querySelector('#studentDeptSelect')?.value,
    programTemplateId: form.querySelector('#studentProgSelect')?.value,
    enrollmentDate: form.querySelector('#studentEnrollDate')?.value,
    status: form.querySelector('#studentStatusSelect')?.value,
    assignedSupervisorId: form.querySelector('#studentSupervisorSelect')?.value || null,
    // expectedCompletionDate: form.querySelector('#student-expected-completion').value,
  };

  if (!formData.fullName || !formData.studentIdNumber) {
    showAdminError('Full Name and Student ID Number are required.');
    return;
  }

  try {
    showAdminLoading('Updating student...');
    const supabase = await getSupabaseClient();
    
    const { data: existingStudent, error: fetchError } = await supabase
        .from('students').select('user_id, program_name').eq('id', adminSelectedStudent).single();
    if (fetchError || !existingStudent) throw fetchError || new Error("Original student record not found.");
    const userId = existingStudent.user_id;

    // 1. Update Auth User Metadata
    const userMetadata = { full_name: formData.fullName, student_id_number: formData.studentIdNumber, department_id: formData.departmentId };
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, { user_metadata: userMetadata });
    if (updateAuthError) throw new Error(`Auth update error: ${updateAuthError.message}`);

    // Determine program_name if template is used
    let programNameValue = existingStudent.program_name; // Keep existing if not changing template
    if (formData.programTemplateId) {
        const selectedTemplate = availableProgramTemplates.find(pt => pt.id.toString() === formData.programTemplateId.toString());
        programNameValue = selectedTemplate ? selectedTemplate.name : programNameValue;
    }

    // 2. Update Student Profile
    const studentProfileUpdates = {
      student_id: formData.studentIdNumber, // This is the display ID, not primary key
      department_id: formData.departmentId,
      program_template_id: formData.programTemplateId || null,
      program_name: programNameValue,
      enrollment_date: formData.enrollmentDate || null,
      status: formData.status,
      // expected_completion_date: formData.expectedCompletionDate || null,
      supervisor_id: formData.assignedSupervisorId, // Can directly update if design allows (simple FK)
      updated_at: new Date().toISOString()
    };
    const { error: studentDbError } = await supabase.from('students').update(studentProfileUpdates).eq('id', adminSelectedStudent);
    if (studentDbError) throw new Error(`Student profile update error: ${studentDbError.message}`);

    // 3. Handle Supervisor Assignment (if using student_supervisors table)
    // This part is more complex if student_supervisors is the source of truth
    // For simplicity, if student.supervisor_id is used, it's updated above.
    // If student_supervisors table:
    //      a. Remove existing links for this student
    //      b. Add new link if assignedSupervisorId is present
    // For now, relying on student.supervisor_id being updated directly.

    hideAdminLoading();
    showAdminSuccess('Student updated successfully!');
    await loadStudentsList(supabase);
    closeModal(form.closest('.modal-container, .modal')?.id);

  } catch (error) {
    console.error('Error saving student changes:', error);
    hideAdminLoading();
    showAdminError(`Failed to save student: ${error.message}`);
  }
}

/**
 * Open modal to add a new student.
 */
function openAddStudentModal() {
  adminSelectedStudent = null; // Clear selection
  const modalContainer = document.getElementById('studentModal') || document.getElementById('add-student-modal-container');
  if (!modalContainer) { showAdminError("Add student modal not found."); return; }
  const form = modalContainer.querySelector('form');
  if (form) {
    form.reset();
    form.querySelector('#studentEmail').disabled = false; // Enable email for new user
    const idInput = form.querySelector('#studentId'); // Hidden input for DB ID
    if (idInput) idInput.value = '';
  }
  
  const modalTitle = modalContainer.querySelector('.modal-title') || modalContainer.querySelector('#studentModalTitle');
  if(modalTitle) modalTitle.textContent = 'Add New Student';

  // Populate selects
  const deptSelect = form.querySelector('#studentDeptSelect');
  if(deptSelect && availableDepartments) populateSelectWithOptions(deptSelect, availableDepartments, "Select Department", "id", "name");
  
  const progSelect = form.querySelector('#studentProgSelect');
  if(progSelect && availableProgramTemplates) populateSelectWithOptions(progSelect, availableProgramTemplates, "Select Program", "id", "name");

  const supSelect = form.querySelector('#studentSupervisorSelect');
  if(supSelect && availableSupervisorsForSelect) populateSelectWithOptions(supSelect, availableSupervisorsForSelect, "Select Supervisor", "id", "name");

  modalContainer.classList.remove('hidden');
}

/**
 * Handle add student form submission.
 */
async function handleAddStudentSubmit(event) {
  event.preventDefault();
  const form = event.target;

  const fullName = form.querySelector('#studentName')?.value.trim();
  const email = form.querySelector('#studentEmail')?.value.trim();
  const password = form.querySelector('#studentPassword')?.value;
  const studentIdNumber = form.querySelector('#studentIdInput')?.value.trim(); // This is student's school ID
  const departmentId = form.querySelector('#studentDeptSelect')?.value;
  const programTemplateId = form.querySelector('#studentProgSelect')?.value;
  const enrollmentDate = form.querySelector('#studentEnrollDate')?.value;
  // const expectedCompletionDate = form.querySelector('#student-expected-completion').value;
  const assignedSupervisorId = form.querySelector('#studentSupervisorSelect')?.value || null;

  if (!fullName || !email || !password || !studentIdNumber) {
    showAdminError('Full Name, Email, Password, and Student ID Number are required.');
    return;
  }

  try {
    showAdminLoading('Creating new student...');
    const supabase = await getSupabaseClient();

    // 1. Create Auth User
    const userMetadata = { 
        full_name: fullName, 
        student_id_number: studentIdNumber, 
        department_id: departmentId,
        organization_id: adminCurrentOrganization.id 
    };
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email, password: password, email_confirm: true, user_metadata: userMetadata
    });
    if (authError) throw new Error(`Auth creation error: ${authError.message}`);
    const userId = authData.user.id;

    // Get program_name from selected template
    let programNameValue = 'N/A';
    if (programTemplateId) {
        const selectedTemplate = availableProgramTemplates.find(pt => pt.id.toString() === programTemplateId.toString());
        programNameValue = selectedTemplate ? selectedTemplate.name : 'Program (from template)';
    }
    
    // 2. Create Student Profile in 'students' table
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .insert({
        user_id: userId,
        organization_id: adminCurrentOrganization.id,
        student_id: studentIdNumber, // Storing the display ID
        department_id: departmentId,
        program_template_id: programTemplateId || null,
        program_name: programNameValue,
        supervisor_id: assignedSupervisorId,
        enrollment_date: enrollmentDate || null,
        // expected_completion_date: expectedCompletionDate || null,
        status: 'active', // Default status
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select().single();
    if (studentError) throw new Error(`Student profile creation: ${studentError.message}`);
    const studentRecordId = studentData.id;

    // 3. Assign 'student' role in 'user_roles'
    const studentRole = availableRoles.find(r => r.name.toLowerCase() === 'student');
    if (studentRole) {
      await supabase.from('user_roles').insert({
        user_id: userId, role_id: studentRole.id, organization_id: adminCurrentOrganization.id
      }); // Error handling can be added here
    } else {
        console.warn("Default 'student' role not found in availableRoles. Cannot assign role to new student.");
    }

    // 4. If using student_supervisors table for assignments (optional, if student.supervisor_id is not primary)
    // if (assignedSupervisorId) {
    //     await supabase.from('student_supervisors').insert({
    //         student_id: studentRecordId, supervisor_id: assignedSupervisorId, is_primary: true
    //     });
    // }

    hideAdminLoading();
    showAdminSuccess('Student created successfully!');
    await loadStudentsList(supabase); // Refresh table
    closeModal(form.closest('.modal-container, .modal')?.id);

  } catch (error) {
    console.error('Error creating student:', error);
    hideAdminLoading();
    showAdminError(`Failed to create student: ${error.message}`);
  }
}

/**
 * Update student status (active/suspended)
 */
async function updateStudentStatus(studentId, newStatus) {
  try {
    if (!confirm(`Are you sure you want to ${newStatus === 'active' ? 'activate' : 'suspend'} this student?`)) return;
    showAdminLoading(`${capitalize(newStatus)} student...`);
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('students')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', studentId);
    if (error) throw error;
    
    hideAdminLoading();
    showAdminSuccess(`Student ${newStatus}d successfully.`);
    await loadStudentsList(supabase); // Refresh list
  } catch (error) {
    console.error(`Error ${newStatus}ing student:`, error);
    hideAdminLoading();
    showAdminError(`Failed to update student status: ${error.message}`);
  }
}


// ------------------------------------------------------------------------
// ORIGINAL FUNCTIONS TO KEEP (potentially for utilities or unreplaced functionality)
// ------------------------------------------------------------------------

/**
 * Initializes basic UI components with data (e.g., user name, portal type). (Kept from original)
 */
function initializeUIComponents() {
    try {
        if (AdminDOM.userNameDisplay && adminCurrentUser && adminCurrentUser.user_metadata) {
            AdminDOM.userNameDisplay.textContent = adminCurrentUser.user_metadata.full_name || adminCurrentUser.email;
        } else if (AdminDOM.userNameDisplay && adminCurrentUser) {
             AdminDOM.userNameDisplay.textContent = adminCurrentUser.email;
        }

        // if (AdminDOM.userAvatar && adminCurrentUser?.user_metadata?.avatar_url) { // Avatar handling might need update
        //     AdminDOM.userAvatar.src = adminCurrentUser.user_metadata.avatar_url;
        // }
        if (AdminDOM.portalType) {
            AdminDOM.portalType.textContent = 'Admin Portal'; 
        }
        console.log('admin.js: Basic UI components updated (original function).');
    } catch (error) {
        console.error('admin.js: Error initializing UI components (original function):', error);
    }
}

/**
 * Shows a confirmation modal before proceeding with deletion. (Kept from original)
 * @param {object} item - Object containing item id, name, type, and userId (for auth deletion).
 */
function confirmThenDelete(item) { // item = { id, userId, name, type }
    // This function uses AdminDOM elements for the delete confirmation modal.
    // Ensure these (deleteConfirmModal, deleteConfirmText, confirmDeleteBtn) are cached if used.
    // The new cacheAdminDOMElements is a stub. If these AdminDOM elements are not cached by other means,
    // this function might fail or need to use direct getElementById.
    // For now, assuming AdminDOM might be populated by an updated cache function or they exist in HTML.

    const deleteConfirmModal = AdminDOM.deleteConfirmModal || document.getElementById('deleteConfirmModal');
    const deleteConfirmText = AdminDOM.deleteConfirmText || document.getElementById('deleteConfirmText');
    let confirmDeleteBtn = AdminDOM.confirmDeleteBtn || document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = AdminDOM.cancelDeleteBtn || document.getElementById('cancelDeleteBtn');


    if (!deleteConfirmModal || !deleteConfirmText || !confirmDeleteBtn) {
        // Fallback to simple confirm if modal is broken
        if (confirm(`Are you sure you want to delete ${item.type} "${item.name}"? This cannot be undone.`)) {
            if (item.type === 'student') deleteStudent(item.id, item.userId);
            else if (item.type === 'supervisor') deleteSupervisor(item.id, item.userId);
        }
        showAdminError("Delete confirmation modal elements not found. Used fallback confirm.");
        return;
    }

    deleteConfirmText.textContent = `Are you sure you want to delete ${item.type} "${item.name}"? This action cannot be undone and will remove all associated data.`;
    deleteConfirmModal.classList.remove('hidden');

    // Clone and replace the button to remove previous event listeners
    const newConfirmBtn = confirmDeleteBtn.cloneNode(true);
    confirmDeleteBtn.parentNode.replaceChild(newConfirmBtn, confirmDeleteBtn);
    confirmDeleteBtn = newConfirmBtn; 
    if(AdminDOM.confirmDeleteBtn) AdminDOM.confirmDeleteBtn = newConfirmBtn; // Update cache if using AdminDOM

    confirmDeleteBtn.onclick = async () => { 
        deleteConfirmModal.classList.add('hidden');
        if (item.type === 'student') await deleteStudent(item.id, item.userId);
        else if (item.type === 'supervisor') await deleteSupervisor(item.id, item.userId);
    };
    if(cancelDeleteBtn) cancelDeleteBtn.onclick = () => deleteConfirmModal.classList.add('hidden');
}


async function deleteStudent(studentId, userId) {
    // This function uses original showLoading, displaySuccessMessage, displayErrorMessage
    // These should be updated to use showAdminLoading, showAdminSuccess, showAdminError for consistency
    // For now, keeping original calls.
    try {
        showAdminLoading(`Deleting student and associated data...`); // Changed to new loader
        const supabaseClient = getSupabaseClient();

        // Transaction-like behavior: Collect all operations.
        // 1. Delete from 'student_supervisors'
        const { error: supLinkError } = await supabaseClient.from('student_supervisors').delete().eq('student_id', studentId);
        if (supLinkError) throw new Error(`Failed to delete supervisor links: ${supLinkError.message}`);
        
        // 2. Delete from 'student_milestones' (if exists)
        const { error: milestonesError } = await supabaseClient.from('student_milestones').delete().eq('student_id', studentId);
        if (milestonesError && !milestonesError.message.includes('relation "student_milestones" does not exist')) {
             throw new Error(`Failed to delete milestones: ${milestonesError.message}`);
        }
        
        // 3. Delete from 'students' table
        const { error: studentProfileError } = await supabaseClient.from('students').delete().eq('id', studentId);
        if (studentProfileError) throw new Error(`Failed to delete student profile: ${studentProfileError.message}`);

        // 4. Delete user roles
        const { error: rolesError } = await supabaseClient.from('user_roles').delete().eq('user_id', userId).eq('organization_id', adminCurrentOrganization.id);
        if (rolesError) console.warn(`Could not delete user roles for student ${userId}: ${rolesError.message}`);
        
        // 5. Delete from auth.users
        if (userId) {
            const { error: authUserError } = await supabaseClient.auth.admin.deleteUser(userId);
            if (authUserError && !authUserError.message.toLowerCase().includes('user not found')) {
                throw new Error(`Failed to delete auth user: ${authUserError.message}`);
            }
        }
        showAdminSuccess('Student deleted successfully.'); // Changed to new success
        if (typeof loadStudentsList === "function" && supabaseClient) await loadStudentsList(supabaseClient); // Refresh table
        hideAdminLoading(); // Changed to new loader

    } catch (error) {
        console.error('admin.js: Error deleting student (original function):', error);
        showAdminError(`Failed to delete student: ${error.message}`); // Changed to new error
        hideAdminLoading(); // Changed to new loader
    }
}

async function deleteSupervisor(supervisorId, userId) {
    try {
        showAdminLoading('Deleting supervisor and associated data...'); // Changed
        const supabaseClient = getSupabaseClient();

        // 1. Unlink students from this supervisor (or re-assign: more complex)
        const { error: unlinkError } = await supabaseClient.from('student_supervisors').delete().eq('supervisor_id', supervisorId);
        if (unlinkError) throw new Error(`Failed to unlink students: ${unlinkError.message}`);
        // Also consider updating students.supervisor_id if it's a direct FK
        await supabaseClient.from('students').update({ supervisor_id: null }).eq('supervisor_id', supervisorId);


        // 2. Delete from 'supervisors' table
        const { error: supervisorProfileError } = await supabaseClient.from('supervisors').delete().eq('id', supervisorId);
        if (supervisorProfileError) throw new Error(`Failed to delete supervisor profile: ${supervisorProfileError.message}`);

        // 3. Delete associated user roles
         const { error: rolesError } = await supabaseClient.from('user_roles').delete().eq('user_id', userId).eq('organization_id', adminCurrentOrganization.id);
        if (rolesError) console.warn(`Could not delete user roles for supervisor ${userId}: ${rolesError.message}`);
        
        // 4. Delete the user from auth.users
        if (userId) {
            const { error: authUserError } = await supabaseClient.auth.admin.deleteUser(userId);
             if (authUserError && !authUserError.message.toLowerCase().includes('user not found')) {
                throw new Error(`Failed to delete auth user: ${authUserError.message}`);
            }
        }
        showAdminSuccess('Supervisor deleted successfully.'); // Changed
        if (typeof loadSupervisorsList === "function" && supabaseClient) {
             await loadSupervisorsList(supabaseClient); // Refresh table
             await loadSupervisorsForSelect(supabaseClient); // Refresh dropdowns
        }
        hideAdminLoading(); // Changed

    } catch (error) {
        console.error('admin.js: Error deleting supervisor (original function):', error);
        showAdminError(`Failed to delete supervisor: ${error.message}`); // Changed
        hideAdminLoading(); // Changed
    }
}

/**
 * Placeholder for viewing student details. (Kept from original)
 */
function viewStudentDetails(studentId) {
    console.log(`admin.js: Request to view details for student ID (original function): ${studentId}`);
    showAdminSuccess(`Displaying details for student ${studentId} (feature in development).`);
    // Example: openStudentModal('view', studentId); // If you adapt openStudentModal for a 'view' mode.
    // Or, if 'openStudentDetailsModal' is intended to be implemented:
    // if (typeof openStudentDetailsModal === "function") openStudentDetailsModal(studentId);
}


/**
 * Generic toast notification function. (Kept from original)
 */
function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toast-container-admin');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container-admin';
        Object.assign(toastContainer.style, {
            position: 'fixed', top: '20px', right: '20px', zIndex: '10001',
            display: 'flex', flexDirection: 'column', gap: '10px'
        });
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `p-4 rounded-md shadow-lg text-sm max-w-sm break-words ${
        type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 
        type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 
        'bg-blue-100 text-blue-700 border border-blue-200' // Default to info
    }`;
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
    toast.style.transform = 'translateX(100%)';
    toast.innerHTML = `<span>${message}</span>
        <button class="toast-close-btn" style="background:transparent; border:none; color:inherit; float:right; font-size:1.2em; line-height:1; margin-left:10px; cursor:pointer;">&times;</button>`;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; });
    const removeToast = () => {
        toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)';
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    };
    toast.querySelector('.toast-close-btn').addEventListener('click', removeToast);
    setTimeout(removeToast, type === 'error' ? 8000 : 5000);
}


/**
 * Handles navigation for sidebar links (example). (Kept from original)
 */
function handleNavigation(event) {
    event.preventDefault();
    const targetPageId = event.currentTarget.getAttribute('href'); 
    document.querySelectorAll('main > div[id]').forEach(section => section.classList.add('hidden'));
    const activeSection = document.querySelector(targetPageId);
    if (activeSection) {
        activeSection.classList.remove('hidden');
        const pageTitleEl = AdminDOM.pageTitle || document.querySelector('.page-title');
        if(pageTitleEl) pageTitleEl.textContent = targetPageId.substring(1).charAt(0).toUpperCase() + targetPageId.substring(2) + " Management";
        
        const navLinks = AdminDOM.navLinks || document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('bg-gray-700', 'text-white')); 
        event.currentTarget.classList.add('bg-gray-700', 'text-white');
    } else {
        console.warn(`Navigation target ${targetPageId} not found.`);
    }
    console.log(`Mapsd to ${targetPageId} (original function).`);
}


/**
 * Renders pagination controls. (Kept from original)
 */
function renderPagination(container, currentPage, totalPages, onPageChange, context = '') {
    if (!container) { console.warn(`Pagination container for ${context} not found.`); return; }
    container.innerHTML = ''; 
    if (totalPages <= 1) return;

    const nav = document.createElement('nav');
    nav.className = 'relative z-0 inline-flex rounded-md shadow-sm -space-x-px';
    nav.setAttribute('aria-label', `Pagination for ${context}`);

    nav.appendChild(createPageLink(currentPage - 1, '<i class="fas fa-chevron-left"></i>', currentPage === 1, onPageChange, 'Previous'));
    const maxVisiblePages = 5; 
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) startPage = Math.max(1, endPage - maxVisiblePages + 1);
    if (startPage > 1) {
        nav.appendChild(createPageLink(1, '1', false, onPageChange));
        if (startPage > 2) nav.appendChild(createPageEllipsis());
    }
    for (let i = startPage; i <= endPage; i++) nav.appendChild(createPageLink(i, i.toString(), i === currentPage, onPageChange));
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) nav.appendChild(createPageEllipsis());
        nav.appendChild(createPageLink(totalPages, totalPages.toString(), false, onPageChange));
    }
    nav.appendChild(createPageLink(currentPage + 1, '<i class="fas fa-chevron-right"></i>', currentPage === totalPages, onPageChange, 'Next'));
    container.appendChild(nav);

    // Update results text (example)
    // const resultsTextContainer = container.closest('.pagination-controls-container')?.querySelector('.pagination-results-text');
    // if (resultsTextContainer) { /* ... update text ... */ }
}

function createPageLink(page, text, isActiveOrDisabledOrCurrent, onClick, ariaLabel = `Go to page ${page}`) {
    const link = document.createElement('a');
    link.href = '#'; 
    link.innerHTML = text; 
    link.setAttribute('aria-label', ariaLabel);
    // Tailwind classes for pagination items
    link.className = `relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium`;

    if (isActiveOrDisabledOrCurrent && typeof isActiveOrDisabledOrCurrent === 'boolean' && isActiveOrDisabledOrCurrent === true && (text === '<i class="fas fa-chevron-left"></i>' || text === '<i class="fas fa-chevron-right"></i>')) { // Disabled prev/next
        link.classList.add('text-gray-300', 'cursor-not-allowed');
        link.setAttribute('aria-disabled', 'true');
    } else if (isActiveOrDisabledOrCurrent && page === Number(text)) { // Active page number
        link.classList.add('z-10', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-600');
        link.setAttribute('aria-current', 'page');
    } else { // Default clickable page
        link.classList.add('text-gray-700', 'hover:bg-gray-50');
        link.addEventListener('click', (e) => { e.preventDefault(); if(!isActiveOrDisabledOrCurrent || page !== Number(text)) onClick(page); });
    }
    return link;
}

function createPageEllipsis() {
    const span = document.createElement('span');
    span.className = 'relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700';
    span.textContent = '...';
    return span;
}


/**
 * Debounce function. (Kept from original)
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Gets the ISO string for the start of the current week (Monday). (Kept from original)
 */
function getStartOfWeek() {
    const now = new Date();
    const day = now.getDay() || 7; 
    if (day !== 1) now.setHours(-24 * (day - 1));
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
}

/**
 * Gets the ISO string for the end of the current week (Sunday). (Kept from original)
 */
function getEndOfWeek() {
    const start = new Date(getStartOfWeek());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
}

/**
 * Populates a select dropdown with options. (Kept from original)
 */
function populateSelectWithOptions(selectElement, items, defaultOptionText = "Select an option", valueKey = 'id', textKey = 'name') {
    if (!selectElement) return;
    const currentValue = selectElement.value; // Preserve current value if possible
    selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`; 
    if (items && Array.isArray(items)) {
        items.forEach(item => {
            if (item && typeof item === 'object' && item.hasOwnProperty(valueKey) && item.hasOwnProperty(textKey)) {
                const option = document.createElement('option');
                option.value = item[valueKey];
                option.textContent = item[textKey];
                selectElement.appendChild(option);
            }
        });
    }
    // Try to restore previous selection if it's still a valid option
    if (Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
        selectElement.value = currentValue;
    }
}

// Note: The original SCRIPT EXECUTION START block (DOMContentLoaded listener) has been replaced
// by the new one at the beginning of this combined script.
// Any other standalone initializations or global event listeners from the end of the original file
// would need to be reviewed if they are still necessary.