// Configuration for frontend
// This file automatically detects if running locally or on Render

// STEP 1: Deploy your backend first and get its URL
// STEP 2: Replace the URL below with YOUR backend URL from Render
// Example: 'https://underwater-api.onrender.com'
const BACKEND_URL = 'https://your-backend-url.onrender.com'; // ⬅️ CHANGE THIS for production

// Detect environment and set API URL accordingly
const getApiUrl = () => {
    // When testing locally: backend must be running on port 5000 (python app.py in web_backend)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    // When deployed, use the backend URL you set above
    return BACKEND_URL;
};

// Export for use in script.js (script.js falls back to http://localhost:5000 if this is missing)
window.API_URL = getApiUrl();

