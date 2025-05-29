// Student_supevision_system/js/supabaseClient.js - Refactored with singleton pattern

// Global variables for Supabase configuration, ensure they are defined only once
if (typeof window.SUPABASE_URL_CONFIG === 'undefined') {
  window.SUPABASE_URL_CONFIG = 'https://clfnsthhfrjwqbeokckl.supabase.co';
}
if (typeof window.SUPABASE_ANON_KEY_CONFIG === 'undefined') {
  window.SUPABASE_ANON_KEY_CONFIG = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsZm5zdGhoZnJqd3FiZW9rY2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMjM1MzYsImV4cCI6MjA2MjU5OTUzNn0.012pMCsog50ci3LZognLkugYE-cci1rPXV0ThbKXnGI';
}

let supabaseClientInstance = null;
let connectionVerified = false;
let initializing = false; // Flag to prevent multiple initialization attempts concurrently
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Get or create the Supabase client instance
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Object>} Resolves with the Supabase client
 */
function getSupabaseClient(retryCount = 0) {
  return new Promise((resolve, reject) => {
    if (supabaseClientInstance && connectionVerified) {
      return resolve(supabaseClientInstance);
    }

    if (initializing && !connectionVerified) {
      // If initialization is already in progress, wait for it to complete
      const checkInterval = setInterval(() => {
        if (connectionVerified && supabaseClientInstance) {
          clearInterval(checkInterval);
          resolve(supabaseClientInstance);
        } else if (!initializing) { // Initialization failed or was reset
          clearInterval(checkInterval);
          // Retry a new initialization
          getSupabaseClient(retryCount + 1).then(resolve).catch(reject);
        }
      }, 100);
      return;
    }

    initializing = true;

    if (!window.SUPABASE_URL_CONFIG || !window.SUPABASE_ANON_KEY_CONFIG) {
      initializing = false;
      return reject(new Error('Supabase configuration missing (SUPABASE_URL_CONFIG or SUPABASE_ANON_KEY_CONFIG not found on window object).'));
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      initializing = false;
      return reject(new Error('Supabase JS library not loaded or createClient function is missing.'));
    }

    if (!supabaseClientInstance) {
      console.log('Attempting to create Supabase client instance...');
      try {
        supabaseClientInstance = window.supabase.createClient(
          window.SUPABASE_URL_CONFIG,
          window.SUPABASE_ANON_KEY_CONFIG
        );
      } catch (error) {
        console.error('Failed to create Supabase client instance:', error);
        initializing = false;
        supabaseClientInstance = null; // Ensure it's reset on creation failure
        return reject(error);
      }
    }

    console.log('Supabase client instance created/retrieved. Verifying connection...');
    // Test connection using a simple query (e.g., to 'organizations' as used in original example, or a dedicated health_check table)
    // Using 'organizations' as per your schema context in other files.
    supabaseClientInstance
      .from('organizations') // Assuming 'organizations' table exists and is accessible
      .select('id')
      .limit(1)
      .then(({ error }) => { // We only care if there's an error, not the data itself for a health check
        if (error) {
          console.error('Supabase connection verification failed:', error);
          supabaseClientInstance = null; // Reset on failure
          connectionVerified = false;
          initializing = false;
          if (retryCount < MAX_RETRIES) {
            console.log(`Retrying Supabase connection (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
            setTimeout(() => {
              getSupabaseClient(retryCount + 1).then(resolve).catch(reject);
            }, RETRY_DELAY_MS);
          } else {
            reject(new Error(`Supabase connection failed after ${MAX_RETRIES} retries: ${error.message}`));
          }
        } else {
          console.log('Supabase connection verified successfully.');
          connectionVerified = true;
          initializing = false;
          resolve(supabaseClientInstance);
        }
      })
      .catch(error => { // Catch errors from the .from() call itself
        console.error('Supabase connection verification threw an exception:', error);
        supabaseClientInstance = null; // Reset on failure
        connectionVerified = false;
        initializing = false;
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying Supabase connection due to exception (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          setTimeout(() => {
            getSupabaseClient(retryCount + 1).then(resolve).catch(reject);
          }, RETRY_DELAY_MS);
        } else {
          reject(new Error(`Supabase connection failed after ${MAX_RETRIES} retries (exception): ${error.message}`));
        }
      });
  });
}

// Export as the only way to get a Supabase client by attaching to the window object
window.getSupabaseClient = getSupabaseClient;

// For clarity, you might want to dispatch an event once the client is successfully initialized the first time.
// This can be useful for other modules that depend on it.
// Example:
// getSupabaseClient()
//   .then(() => {
//     window.dispatchEvent(new CustomEvent('supabaseClientReady'));
//     console.log("Initial Supabase client readiness event dispatched.");
//   })
//   .catch(err => {
//     window.dispatchEvent(new CustomEvent('supabaseClientError', { detail: err }));
//     console.error("Initial Supabase client readiness failed:", err);
//   });

console.log('supabaseClient.js loaded and getSupabaseClient is available on window object.');