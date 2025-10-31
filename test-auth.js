// Test script to check authentication
// Run this in browser console

async function testAuth() {
    const token = localStorage.getItem('auth_token');
    console.log('Token exists:', !!token);

    if (token) {
        console.log('Token length:', token.length);
        console.log('Token starts with:', token.substring(0, 20) + '...');

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('Token payload:', payload);
            console.log('Token expires at:', new Date(payload.exp * 1000));
            console.log('Current time:', new Date());
            console.log('Token expired:', Date.now() > payload.exp * 1000);
        } catch (e) {
            console.error('Invalid token format:', e);
        }
    }

    // Test the auth validate endpoint
    try {
        const response = await fetch('http://localhost:3001/api/auth/validate', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Auth validate response status:', response.status);
        const responseText = await response.text();
        console.log('Auth validate response:', responseText);

        if (!response.ok) {
            try {
                const errorData = JSON.parse(responseText);
                console.log('Error details:', errorData);
            } catch (e) {
                console.log('Could not parse error response as JSON');
            }
        }
    } catch (error) {
        console.error('Network error testing auth:', error);
    }
}

testAuth();