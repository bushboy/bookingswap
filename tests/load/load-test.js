import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Import centralized wallet configuration
const WALLET_CONFIG = {
  PRIMARY_TESTNET_ACCOUNT: '0.0.6199687',
  SECONDARY_TESTNET_ACCOUNT: '0.0.6199688',
  TERTIARY_TESTNET_ACCOUNT: '0.0.6199689', // For third test user
};

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.05'],    // Error rate must be below 5%
    errors: ['rate<0.1'],              // Custom error rate below 10%
  },
};

const BASE_URL = 'http://localhost:3001';

// Test data
const testUsers = [
  { id: 'user1', walletAddress: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT },
  { id: 'user2', walletAddress: WALLET_CONFIG.SECONDARY_TESTNET_ACCOUNT },
  { id: 'user3', walletAddress: WALLET_CONFIG.TERTIARY_TESTNET_ACCOUNT },
];

const testBookings = [
  {
    title: 'Load Test Hotel Booking',
    type: 'hotel',
    city: 'New York',
    country: 'USA',
    checkIn: '2024-12-20',
    checkOut: '2024-12-25',
    originalPrice: 1000,
    swapValue: 900,
    provider: 'Booking.com',
    confirmationNumber: 'LT123456',
  },
  {
    title: 'Load Test Event Tickets',
    type: 'event',
    city: 'Los Angeles',
    country: 'USA',
    checkIn: '2024-12-22',
    checkOut: '2024-12-22',
    originalPrice: 500,
    swapValue: 550,
    provider: 'Ticketmaster',
    confirmationNumber: 'LT789012',
  },
];

// Authentication helper
function authenticate(userId, walletAddress) {
  const authPayload = {
    walletAddress: walletAddress,
    signature: 'mock-signature-' + userId,
    message: 'Login to Booking Swap Platform',
  };

  const authResponse = http.post(`${BASE_URL}/api/auth/wallet`, JSON.stringify(authPayload), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(authResponse, {
    'authentication successful': (r) => r.status === 200,
  }) || errorRate.add(1);

  return authResponse.json('token');
}

// Main test scenario
export default function () {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  const token = authenticate(user.id, user.walletAddress);

  if (!token) {
    console.error('Authentication failed for user:', user.id);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Test 1: Search bookings
  testSearchBookings(headers);
  sleep(1);

  // Test 2: Create booking
  testCreateBooking(headers);
  sleep(1);

  // Test 3: Get user dashboard
  testUserDashboard(headers);
  sleep(1);

  // Test 4: Swap operations
  testSwapOperations(headers);
  sleep(1);

  // Test 5: Blockchain operations
  testBlockchainOperations(headers);
  sleep(2);
}

function testSearchBookings(headers) {
  const searchParams = {
    city: 'New York',
    type: 'hotel',
    dateFrom: '2024-12-01',
    dateTo: '2024-12-31',
    page: 1,
    limit: 10,
  };

  const searchUrl = `${BASE_URL}/api/bookings?${new URLSearchParams(searchParams)}`;
  const response = http.get(searchUrl, { headers });

  check(response, {
    'search bookings status is 200': (r) => r.status === 200,
    'search response has bookings': (r) => {
      const body = JSON.parse(r.body);
      return body.bookings && Array.isArray(body.bookings);
    },
    'search response time < 1s': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);
}

function testCreateBooking(headers) {
  const booking = testBookings[Math.floor(Math.random() * testBookings.length)];

  // Add random suffix to avoid conflicts
  booking.confirmationNumber += '-' + Math.random().toString(36).substr(2, 9);

  const response = http.post(`${BASE_URL}/api/bookings`, JSON.stringify(booking), { headers });

  check(response, {
    'create booking status is 201': (r) => r.status === 201,
    'create booking returns id': (r) => {
      const body = JSON.parse(r.body);
      return body.id && typeof body.id === 'string';
    },
    'create booking response time < 2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);

  return response.json('id');
}

function testUserDashboard(headers) {
  const response = http.get(`${BASE_URL}/api/users/dashboard`, { headers });

  check(response, {
    'dashboard status is 200': (r) => r.status === 200,
    'dashboard has user data': (r) => {
      const body = JSON.parse(r.body);
      return body.user && body.bookings !== undefined && body.swaps !== undefined;
    },
    'dashboard response time < 1s': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);
}

function testSwapOperations(headers) {
  // Get available swaps
  const swapsResponse = http.get(`${BASE_URL}/api/swaps`, { headers });

  check(swapsResponse, {
    'get swaps status is 200': (r) => r.status === 200,
    'get swaps response time < 1s': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);

  // Create a swap proposal (mock)
  const swapProposal = {
    sourceBookingId: 'booking-' + Math.random().toString(36).substr(2, 9),
    targetBookingId: 'booking-' + Math.random().toString(36).substr(2, 9),
    terms: {
      additionalPayment: 100,
      conditions: ['Valid ID required'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };

  const createSwapResponse = http.post(`${BASE_URL}/api/swaps`, JSON.stringify(swapProposal), { headers });

  check(createSwapResponse, {
    'create swap proposal response time < 2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);
}

function testBlockchainOperations(headers) {
  // Test blockchain transaction submission
  const transactionData = {
    type: 'booking-creation',
    bookingId: 'booking-' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
  };

  const blockchainResponse = http.post(
    `${BASE_URL}/api/blockchain/submit-transaction`,
    JSON.stringify(transactionData),
    { headers }
  );

  check(blockchainResponse, {
    'blockchain transaction response time < 3s': (r) => r.timings.duration < 3000,
  }) || errorRate.add(1);

  // Test transaction verification
  if (blockchainResponse.status === 200) {
    const txId = blockchainResponse.json('transactionId');
    if (txId) {
      const verifyResponse = http.get(`${BASE_URL}/api/blockchain/transactions/${txId}`, { headers });

      check(verifyResponse, {
        'transaction verification response time < 1s': (r) => r.timings.duration < 1000,
      }) || errorRate.add(1);
    }
  }
}

// Stress test scenario
export function stressTest() {
  const user = testUsers[0];
  const token = authenticate(user.id, user.walletAddress);

  if (!token) return;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Rapid fire requests
  for (let i = 0; i < 10; i++) {
    http.get(`${BASE_URL}/api/bookings?page=${i + 1}&limit=20`, { headers });
    sleep(0.1);
  }
}

// Database stress test
export function databaseStressTest() {
  const user = testUsers[1];
  const token = authenticate(user.id, user.walletAddress);

  if (!token) return;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Create multiple bookings rapidly
  for (let i = 0; i < 5; i++) {
    const booking = {
      ...testBookings[0],
      title: `Stress Test Booking ${i}`,
      confirmationNumber: `STRESS${i}-${Date.now()}`,
    };

    http.post(`${BASE_URL}/api/bookings`, JSON.stringify(booking), { headers });
    sleep(0.2);
  }
}

// Blockchain stress test
export function blockchainStressTest() {
  const user = testUsers[2];
  const token = authenticate(user.id, user.walletAddress);

  if (!token) return;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Submit multiple blockchain transactions
  for (let i = 0; i < 3; i++) {
    const transactionData = {
      type: 'stress-test',
      data: `Stress test transaction ${i}`,
      timestamp: new Date().toISOString(),
    };

    http.post(`${BASE_URL}/api/blockchain/submit-transaction`, JSON.stringify(transactionData), { headers });
    sleep(1);
  }
}