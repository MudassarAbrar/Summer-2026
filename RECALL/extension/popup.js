// Recall Browser Extension Popup Logic

const SUPABASE_URL = 'https://ouhvnapdhgqgdccimslt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91aHZuYXBkaGdxZ2RjY2ltc2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDUyODYsImV4cCI6MjA5NjQyMTI4Nn0.buF8m_PJqlk187P70dDkArAtYLGarWtW7UNWpdurrW0';

// Initialize Supabase Client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const views = {
  loading: document.getElementById('loading-view'),
  auth: document.getElementById('auth-view'),
  save: document.getElementById('save-view'),
  success: document.getElementById('success-view'),
};

const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const authBtn = document.getElementById('auth-btn');
const authSpinner = document.getElementById('auth-spinner');
const authBtnText = document.getElementById('auth-btn-text');

const pageTitle = document.getElementById('page-title');
const pageUrl = document.getElementById('page-url');
const pageNote = document.getElementById('page-note');
const saveBtn = document.getElementById('save-btn');
const saveError = document.getElementById('save-error');
const saveSpinner = document.getElementById('save-spinner');
const saveBtnText = document.getElementById('save-btn-text');

const userDisplay = document.getElementById('user-display');
const logoutBtn = document.getElementById('logout-btn');

let activeTab = null;
let currentUser = null;

// Helpers
function switchView(viewName) {
  Object.keys(views).forEach(name => {
    if (name === viewName) {
      views[name].classList.add('active-view');
    } else {
      views[name].classList.remove('active-view');
    }
  });
}

function showError(el, message) {
  if (message) {
    el.innerText = message;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function getPlatform(url) {
  if (!url) return 'other';
  const lowercaseUrl = url.toLowerCase();
  if (lowercaseUrl.includes('youtube.com') || lowercaseUrl.includes('youtu.be')) return 'youtube';
  if (lowercaseUrl.includes('tiktok.com')) return 'tiktok';
  if (lowercaseUrl.includes('instagram.com')) return 'instagram';
  if (lowercaseUrl.includes('linkedin.com')) return 'linkedin';
  if (lowercaseUrl.includes('twitter.com') || lowercaseUrl.includes('x.com')) return 'twitter';
  return 'other';
}

// Session Management
async function checkSession() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    
    if (session && session.user) {
      currentUser = session.user;
      userDisplay.innerText = currentUser.email;
      switchView('save');
      await loadTabInfo();
    } else {
      currentUser = null;
      switchView('auth');
    }
  } catch (err) {
    console.error('Session check error:', err);
    switchView('auth');
  }
}

// Get current active tab details
async function loadTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      activeTab = tab;
      pageTitle.innerText = tab.title || 'Untitled Page';
      pageUrl.innerText = tab.url;
    } else {
      showError(saveError, 'Could not retrieve current tab URL. Make sure you are on a webpage.');
      saveBtn.disabled = true;
    }
  } catch (err) {
    console.error('Tab query error:', err);
    showError(saveError, 'Error accessing tab info.');
    saveBtn.disabled = true;
  }
}

// Log In Handler
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = authEmail.value.trim();
  const password = authPassword.value;
  
  if (!email || !password) {
    showError(authError, 'Please enter both email and password.');
    return;
  }
  
  showError(authError, null);
  authBtn.disabled = true;
  authSpinner.style.display = 'inline-block';
  authBtnText.innerText = 'Logging in...';
  
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    if (data.user) {
      currentUser = data.user;
      userDisplay.innerText = currentUser.email;
      switchView('save');
      await loadTabInfo();
    }
  } catch (err) {
    console.error('Login error:', err);
    showError(authError, err.message || 'Login failed. Please check credentials.');
  } finally {
    authBtn.disabled = false;
    authSpinner.style.display = 'none';
    authBtnText.innerText = 'Log In';
  }
});

// Log Out Handler
logoutBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    
    currentUser = null;
    authEmail.value = '';
    authPassword.value = '';
    showError(authError, null);
    switchView('auth');
  } catch (err) {
    console.error('Logout error:', err);
  }
});

// Save Link Handler
saveBtn.addEventListener('click', async () => {
  if (!activeTab || !activeTab.url || !currentUser) {
    showError(saveError, 'Cannot save link: session or tab details missing.');
    return;
  }
  
  showError(saveError, null);
  saveBtn.disabled = true;
  saveSpinner.style.display = 'inline-block';
  saveBtnText.innerText = 'Saving...';
  
  const note = pageNote.value.trim();
  const url = activeTab.url;
  const title = activeTab.title || 'Untitled Page';
  const platform = getPlatform(url);
  
  try {
    const { error } = await supabaseClient
      .from('links')
      .insert({
        user_id: currentUser.id,
        url: url,
        title: title,
        user_note: note || null,
        status: 'pending',
        platform: platform
      });
      
    if (error) throw error;
    
    switchView('success');
    
    // Auto-close popup after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);
    
  } catch (err) {
    console.error('Save error:', err);
    showError(saveError, err.message || 'Failed to save link to Recall.');
    saveBtn.disabled = false;
    saveSpinner.style.display = 'none';
    saveBtnText.innerText = 'Save to Recall';
  }
});

// Start checking session when popup opens
checkSession();
