/**
 * OAuth Authentication Module
 * Handles OAuth flows for multiple providers (Google, GitHub)
 */

const AUTH_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
    redirectUri: window.location.origin + '/callback/'
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || 'YOUR_GITHUB_CLIENT_ID',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email'],
    redirectUri: window.location.origin + '/callback/'
  }
};

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState() {
  const state = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
  sessionStorage.setItem('oauth_state', state);
  return state;
}

/**
 * Verify the state parameter matches what we stored
 */
function verifyState(state) {
  const storedState = sessionStorage.getItem('oauth_state');
  sessionStorage.removeItem('oauth_state');
  return state === storedState;
}

/**
 * Store authorization code for later exchange
 */
function storeAuthCode(code, provider) {
  sessionStorage.setItem('auth_code_' + provider, code);
  sessionStorage.setItem('auth_provider', provider);
}

/**
 * Retrieve stored auth code
 */
function getAuthCode(provider) {
  return sessionStorage.getItem('auth_code_' + provider);
}

/**
 * Start OAuth flow for a given provider
 */
function initOAuthFlow(provider) {
  if (!AUTH_CONFIG[provider]) {
    console.error('Unknown provider:', provider);
    return;
  }

  const config = AUTH_CONFIG[provider];
  const state = generateState();

  // Store redirect page for post-auth navigation
  sessionStorage.setItem('oauth_redirect', 'register');

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state: state
  });

  if (provider === 'github') {
    params.set('allow_signup', 'true');
  }

  window.location.href = config.authUrl + '?' + params.toString();
}

/**
 * Handle OAuth callback - extract code from URL
 */
function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    console.error('OAuth error:', error);
    showError('Authentication failed: ' + error);
    return null;
  }

  if (!code || !state) {
    console.warn('No OAuth code or state in URL');
    return null;
  }

  if (!verifyState(state)) {
    console.error('State mismatch - possible CSRF attack');
    showError('Authentication failed: Invalid state');
    return null;
  }

  return code;
}

/**
 * Exchange authorization code for user info (client-side only with backend)
 * In production, this should happen on your backend for security
 */
async function exchangeCodeForUser(code, provider) {
  try {
    // Client calls backend endpoint to securely exchange code
    const response = await fetch('/api/auth/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: code,
        provider: provider
      })
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    const data = await response.json();
    
    // Store user session
    if (data.user) {
      sessionStorage.setItem('user_data', JSON.stringify(data.user));
      sessionStorage.setItem('auth_token', data.token);
      return data.user;
    }
    
    return null;
  } catch (error) {
    console.error('Error exchanging code:', error);
    showError('Failed to authenticate');
    return null;
  }
}

/**
 * Get current authenticated user
 */
function getCurrentUser() {
  const userData = sessionStorage.getItem('user_data');
  return userData ? JSON.parse(userData) : null;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!sessionStorage.getItem('auth_token');
}

/**
 * Log out user
 */
function logout() {
  sessionStorage.removeItem('user_data');
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_provider');
  sessionStorage.removeItem('oauth_state');
  
  // Notify backend of logout
  fetch('/api/auth/logout', { method: 'POST' }).catch(console.error);
  
  // Redirect to home
  window.location.href = '/';
}

/**
 * Display error message
 */
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'auth-error';
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #FBE8E6;
    color: #B3261E;
    padding: 12px 16px;
    border-radius: 4px;
    z-index: 1000;
  `;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => errorDiv.remove(), 5000);
}

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initOAuthFlow,
    handleOAuthCallback,
    exchangeCodeForUser,
    getCurrentUser,
    isAuthenticated,
    logout
  };
}
