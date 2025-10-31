// Run this in browser console to debug the token
const token = localStorage.getItem('auth_token');
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Token payload:', payload);
    console.log('Token expires at:', new Date(payload.exp * 1000));
    console.log('Current time:', new Date());
    console.log('Token expired:', Date.now() > payload.exp * 1000);
    console.log('User ID:', payload.userId);
  } catch (e) {
    console.error('Invalid token format:', e);
  }
} else {
  console.log('No token found');
}