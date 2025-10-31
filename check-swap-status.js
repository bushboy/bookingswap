#!/usr/bin/env node

/**
 * Diagnostic script to check swap status for proposal creation debugging
 * 
 * Usage: node check-swap-status.js <sourceSwapId> <targetSwapId> <authToken>
 * 
 * Example:
 *   node check-swap-status.js 60972aec-71c8-4428-ba95-d617838f04ce d82b6581-c89b-4d0b-a250-25b91f689d2d YOUR_AUTH_TOKEN
 */

const http = require('http');

const API_BASE_URL = 'http://localhost:3001';

async function makeRequest(path, authToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function checkSwapStatus(swapId, authToken, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label}: ${swapId}`);
  console.log('='.repeat(60));

  try {
    const response = await makeRequest(`/api/swaps/${swapId}`, authToken);
    
    if (response.status === 200) {
      const swap = response.data.data || response.data;
      console.log(`✓ Swap found`);
      console.log(`  Status: ${swap.status}`);
      console.log(`  Owner ID: ${swap.ownerId || swap.userId || 'N/A'}`);
      console.log(`  Created: ${swap.createdAt || 'N/A'}`);
      console.log(`  Acceptance Strategy: ${swap.acceptanceStrategy?.type || 'N/A'}`);
      
      if (swap.bookingDetails) {
        console.log(`  Booking Details:`);
        console.log(`    - Hotel: ${swap.bookingDetails.hotelName || 'N/A'}`);
        console.log(`    - Check-in: ${swap.bookingDetails.checkInDate || 'N/A'}`);
        console.log(`    - Check-out: ${swap.bookingDetails.checkOutDate || 'N/A'}`);
      }
      
      return swap;
    } else if (response.status === 404) {
      console.log(`✗ Swap not found (404)`);
      return null;
    } else {
      console.log(`✗ Error fetching swap (status: ${response.status})`);
      console.log(`  Response:`, JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log(`✗ Error:`, error.message);
    return null;
  }
}

async function checkUserInfo(authToken) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Current User Info');
  console.log('='.repeat(60));

  try {
    const response = await makeRequest('/api/auth/me', authToken);
    
    if (response.status === 200) {
      const user = response.data.data || response.data;
      console.log(`✓ User authenticated`);
      console.log(`  User ID: ${user.id}`);
      console.log(`  Email: ${user.email || 'N/A'}`);
      console.log(`  Wallet Address: ${user.walletAddress || 'Not connected'}`);
      return user;
    } else {
      console.log(`✗ Authentication failed (status: ${response.status})`);
      return null;
    }
  } catch (error) {
    console.log(`✗ Error:`, error.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: node check-swap-status.js <sourceSwapId> <targetSwapId> <authToken>');
    console.error('');
    console.error('Example:');
    console.error('  node check-swap-status.js 60972aec-71c8-4428-ba95-d617838f04ce d82b6581-c89b-4d0b-a250-25b91f689d2d YOUR_AUTH_TOKEN');
    process.exit(1);
  }

  const [sourceSwapId, targetSwapId, authToken] = args;

  console.log('\n🔍 Swap Proposal Diagnostic Tool');
  console.log('================================\n');

  // Check user info
  const user = await checkUserInfo(authToken);
  
  // Check source swap
  const sourceSwap = await checkSwapStatus(sourceSwapId, authToken, 'SOURCE SWAP');
  
  // Check target swap
  const targetSwap = await checkSwapStatus(targetSwapId, authToken, 'TARGET SWAP');

  // Analysis
  console.log(`\n${'='.repeat(60)}`);
  console.log('VALIDATION ANALYSIS');
  console.log('='.repeat(60));

  if (!user) {
    console.log('✗ Cannot proceed - user not authenticated');
    return;
  }

  if (!sourceSwap) {
    console.log('✗ Source swap not found - cannot create proposal');
    return;
  }

  if (!targetSwap) {
    console.log('✗ Target swap not found - cannot create proposal');
    return;
  }

  // Check ownership
  const sourceOwnerId = sourceSwap.ownerId || sourceSwap.userId;
  const targetOwnerId = targetSwap.ownerId || targetSwap.userId;

  console.log('\nOwnership Check:');
  if (sourceOwnerId === user.id) {
    console.log('  ✓ You own the source swap');
  } else {
    console.log(`  ✗ You DO NOT own the source swap (owner: ${sourceOwnerId}, you: ${user.id})`);
  }

  if (targetOwnerId === user.id) {
    console.log('  ✗ You cannot target your own swap');
  } else {
    console.log('  ✓ Target swap is owned by someone else');
  }

  // Check statuses
  console.log('\nStatus Check:');
  if (sourceSwap.status === 'pending') {
    console.log('  ✓ Source swap status is "pending"');
  } else {
    console.log(`  ✗ Source swap status is "${sourceSwap.status}" (must be "pending")`);
  }

  if (targetSwap.status === 'pending') {
    console.log('  ✓ Target swap status is "pending"');
  } else {
    console.log(`  ✗ Target swap status is "${targetSwap.status}" (must be "pending")`);
  }

  // Check same swap
  console.log('\nSame Swap Check:');
  if (sourceSwapId === targetSwapId) {
    console.log('  ✗ Cannot target the same swap');
  } else {
    console.log('  ✓ Different swaps');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const canProceed = 
    user &&
    sourceSwap &&
    targetSwap &&
    sourceOwnerId === user.id &&
    targetOwnerId !== user.id &&
    sourceSwap.status === 'pending' &&
    targetSwap.status === 'pending' &&
    sourceSwapId !== targetSwapId;

  if (canProceed) {
    console.log('✓ All basic validations passed!');
    console.log('\nIf proposal creation is still failing, check backend logs for:');
    console.log('  - One-for-one mode restrictions (existing proposals)');
    console.log('  - Auction eligibility issues');
    console.log('  - Circular targeting detection');
  } else {
    console.log('✗ Validation issues detected - see above for details');
  }

  console.log('\n');
}

main().catch(console.error);

