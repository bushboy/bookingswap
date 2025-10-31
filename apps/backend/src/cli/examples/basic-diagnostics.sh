#!/bin/bash

# Basic Hedera NFT Diagnostics Script
# This script demonstrates common diagnostic workflows

echo "🔍 Starting Hedera NFT Diagnostics..."

# Set the base directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "📍 Working directory: $(pwd)"

# 1. Health Check - Verify basic connectivity
echo ""
echo "🏥 Step 1: Health Check"
npm run hedera-diagnostics health-check

if [ $? -ne 0 ]; then
    echo "❌ Health check failed. Please check your configuration."
    exit 1
fi

# 2. Account Verification - Check account permissions
echo ""
echo "🔐 Step 2: Account Verification"
npm run hedera-diagnostics verify-account

if [ $? -ne 0 ]; then
    echo "⚠️  Account verification issues detected. Check the output above."
fi

# 3. Balance Check - Ensure sufficient funds
echo ""
echo "💰 Step 3: Balance Check"
npm run hedera-diagnostics check-balance --operation mint

if [ $? -ne 0 ]; then
    echo "⚠️  Balance check issues detected. You may need to fund your account."
fi

# 4. Quick Test - Test token creation
echo ""
echo "🧪 Step 4: Quick Token Creation Test"
npm run hedera-diagnostics test token-creation

if [ $? -ne 0 ]; then
    echo "⚠️  Token creation test failed. Check permissions and balance."
fi

# 5. Generate Report - Create comprehensive diagnostic report
echo ""
echo "📊 Step 5: Generate Diagnostic Report"
npm run hedera-diagnostics report --format markdown

if [ $? -eq 0 ]; then
    echo "✅ Diagnostic report generated successfully!"
    echo "📄 Check the ./diagnostic-reports directory for the report file."
else
    echo "❌ Failed to generate diagnostic report."
fi

echo ""
echo "🎉 Basic diagnostics completed!"
echo "💡 For more detailed testing, run: npm run hedera-diagnostics test full-suite"