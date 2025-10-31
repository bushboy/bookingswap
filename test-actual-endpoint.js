// Test the actual running server endpoint
async function testActualEndpoint() {
  const loginData = {
    email: 'debug@test.com',
    password: 'password123'
  };
  
  console.log('Testing actual server endpoint...');
  console.log('Login data:', loginData);
  
  try {
    const response = await fetch('http://localhost:3001/api/auth/email-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body (raw):', responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('✓ Login successful:', data);
      } catch (e) {
        console.error('Could not parse success response as JSON');
      }
    } else {
      console.error('✗ Login failed with status:', response.status);
      try {
        const errorData = JSON.parse(responseText);
        console.error('Error details:', errorData);
      } catch (e) {
        console.error('Could not parse error response as JSON');
        console.error('Raw error response:', responseText);
      }
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

testActualEndpoint();