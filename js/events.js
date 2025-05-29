// Student_supevision_system/js/events.js

/**
 * SystemEvents - Centralized definitions for custom events used throughout the application.
 * This ensures consistency in event naming and usage.
 */
const SystemEvents = {
  // Supabase Client Events
  SUPABASE_CLIENT_INITIALIZED: 'supabase:client:initialized',
  SUPABASE_CLIENT_ERROR: 'supabase:client:error',

  // Authentication Events
  AUTH_MODULE_READY: 'auth:module:ready', // Fired when auth.js has completed its initial setup
  AUTH_STATE_CHANGED: 'auth:state:changed', // Fired on Supabase onAuthStateChange
  AUTH_LOGIN_SUCCESS: 'auth:login:success',
  AUTH_LOGIN_FAILED: 'auth:login:failed',
  AUTH_LOGOUT_SUCCESS: 'auth:logout:success',
  AUTH_LOGOUT_FAILED: 'auth:logout:failed',
  AUTH_PASSWORD_RESET_SENT: 'auth:password:reset:sent',
  AUTH_PASSWORD_UPDATED: 'auth:password:updated',
  AUTH_ERROR: 'auth:error', // General auth errors

  // Application Initialization Events (from app.js)
  APP_INIT_STARTED: 'app:init:started',
  APP_INIT_SUCCESS: 'app:init:success',
  APP_INIT_FAILED: 'app:init:failed',

  // Dashboard Lifecycle Events (generic, can be specified further by specific dashboards)
  DASHBOARD_INIT_STARTED: 'dashboard:init:started',     // e.g., student:dashboard:init:started
  DASHBOARD_INIT_SUCCESS: 'dashboard:init:success',   // e.g., student:dashboard:init:success
  DASHBOARD_INIT_FAILED: 'dashboard:init:failed',     // e.g., student:dashboard:init:failed
  DASHBOARD_DATA_LOADING: 'dashboard:data:loading',
  DASHBOARD_DATA_LOADED: 'dashboard:data:loaded',
  DASHBOARD_DATA_ERROR: 'dashboard:data:error',

  // Data Specific Events (examples)
  STUDENT_PROFILE_LOADED: 'data:student:profile:loaded',
  SUPERVISOR_PROFILE_LOADED: 'data:supervisor:profile:loaded',
  ADMIN_DATA_LOADED: 'data:admin:all:loaded',
  // Add more specific data events as needed:
  // e.g., MEETINGS_LOADED, SUBMISSIONS_LOADED, THESES_LOADED

  // UI Interaction Events (examples)
  MODAL_OPENED: 'ui:modal:opened',
  MODAL_CLOSED: 'ui:modal:closed',
  NOTIFICATION_SHOWN: 'ui:notification:shown',

  // Configuration Events
  CONFIG_LOADED: 'config:loaded',
};

// Make SystemEvents globally accessible
window.SystemEvents = SystemEvents;

/**
 * Emits a custom event on the window object.
 * @param {string} eventName - The name of the event to emit (should be from SystemEvents).
 * @param {Object} [data=null] - Optional data to pass with the event.
 */
function emitEvent(eventName, data = null) {
  if (!eventName) {
    console.warn('emitEvent: eventName is required.');
    return;
  }
  // For debugging or logging, it's helpful to see which events are fired.
  // console.log(`Event emitted: ${eventName}`, data);
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  } catch (error) {
    console.error(`Error dispatching event "${eventName}":`, error, data);
  }
}

// Make emitEvent globally accessible
window.emitEvent = emitEvent;

/**
 * Adds an event listener to the window object for a custom event.
 * @param {string} eventName - The name of the event to listen for (should be from SystemEvents).
 * @param {Function} callback - The function to execute when the event is triggered.
 * The callback will receive the event.detail as its argument.
 */
function onEvent(eventName, callback) {
  if (!eventName || typeof callback !== 'function') {
    console.warn('onEvent: eventName and a valid callback function are required.');
    return;
  }
  try {
    window.addEventListener(eventName, (event) => {
      // Pass event.detail to the callback, which is the data payload
      callback(event.detail);
    });
  } catch (error) {
    console.error(`Error adding listener for event "${eventName}":`, error);
  }
}

// Make onEvent globally accessible
window.onEvent = onEvent;

console.log('events.js loaded: SystemEvents, emitEvent, and onEvent are available on window object.');