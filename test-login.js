// Test login endpoint directly
// Run this in browser console

async function testLogin() {
  const loginData = {
    email: 'test@example.com', // Replace with your test email
    password: 'testpassword'   // Replace with your test password
  };
  
  console.log('Testing login with:', loginData);
  
  try {
    const response = await fetch('http://localhost:3001/api/auth/email-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    });
    
    console.log('Login response status:', response.status);
    console.log('Login response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Login response body:', responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('Login successful:', data);
        
        // Store token for testing
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('auth_user', JSON.stringify(data.user));
          console.log('Token stored in localStorage');
        }
      } catch (e) {
        console.error('Could not parse success response as JSON');
      }
    } else {
      try {
        const errorData = JSON.parse(responseText);
        console.error('Login failed:', errorData);
      } catch (e) {
        console.error('Could not parse error response as JSON');
      }
    }
  } catch (error) {
    console.error('Network error during login:', error);
  }
}

// Also test if we can reach the backend at all
async function testBackendHealth() {
  try {
    const response = await fetch('http://localhost:3001/health');
    console.log('Backend health status:', response.status);
    const health = await response.json();
    console.log('Backend health:', health);
  } catch (error) {
    console.error('Cannot reach backend:', error);
  }
}

console.log('Testing backend health first...');
testBackendHealth().then(() => {
  console.log('Now testing login...');
  testLogin();
});