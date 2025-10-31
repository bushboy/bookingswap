#!/bin/bash

# Hedera NFT Troubleshooting Workflow Script
# Use this script when experiencing NFT minting issues

echo "🔧 Starting Hedera NFT Troubleshooting Workflow..."

# Set the base directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Check if token ID is provided
TOKEN_ID=${1:-$HEDERA_TOKEN_ID}

if [ -z "$TOKEN_ID" ]; then
    echo "⚠️  No token ID provided. Some tests will create a new token."
    echo "💡 Usage: $0 <token-id>"
    echo "💡 Or set HEDERA_TOKEN_ID environment variable"
else
    echo "🎫 Using token ID: $TOKEN_ID"
fi

echo ""
echo "🔍 Troubleshooting NFT Issues..."

# Step 1: Verify basic connectivity
echo ""
echo "📡 Step 1: Network Connectivity Check"
npm run hedera-diagnostics health-check --verbose

if [ $? -ne 0 ]; then
    echo "❌ Network connectivity failed!"
    echo "💡 Check your internet connection and Hedera network status"
    exit 1
fi

# Step 2: Detailed account verification
echo ""
echo "🔐 Step 2: Detailed Account Verification"
if [ -n "$TOKEN_ID" ]; then
    npm run hedera-diagnostics verify-account --token-id "$TOKEN_ID" --verbose
else
    npm run hedera-diagnostics verify-account --verbose
fi

# Step 3: Balance verification for different operations
echo ""
echo "💰 Step 3: Balance Verification"
echo "   Checking balance for token creation..."
npm run hedera-diagnostics check-balance --operation create_token

echo "   Checking balance for NFT minting..."
npm run hedera-diagnostics check-balance --operation mint

echo "   Checking balance for NFT transfer..."
npm run hedera-diagnostics check-balance --operation transfer

# Step 4: Individual operation tests
echo ""
echo "🧪 Step 4: Individual Operation Tests"

echo "   Testing token creation..."
npm run hedera-diagnostics test token-creation --verbose

if [ -n "$TOKEN_ID" ]; then
    echo "   Testing NFT minting with existing token..."
    npm run hedera-diagnostics test nft-minting --token-id "$TOKEN_ID" --verbose
    
    echo "   Testing NFT query..."
    # Note: This assumes serial number 1 exists, adjust as needed
    npm run hedera-diagnostics test nft-query --token-id "$TOKEN_ID" --serial 1 --verbose 2>/dev/null || echo "   (No existing NFT found for query test)"
else
    echo "   Testing NFT minting with new token..."
    npm run hedera-diagnostics test nft-minting --verbose
fi

# Step 5: Generate comprehensive diagnostic report
echo ""
echo "📊 Step 5: Comprehensive Diagnostic Report"
REPORT_OPTIONS="--format json --full-test-suite --include-failures"

if [ -n "$TOKEN_ID" ]; then
    REPORT_OPTIONS="$REPORT_OPTIONS --token-id $TOKEN_ID"
fi

npm run hedera-diagnostics report $REPORT_OPTIONS --verbose

# Step 6: Provide troubleshooting summary
echo ""
echo "📋 Troubleshooting Summary"
echo "=========================="

# Check if reports were generated
REPORT_DIR="./diagnostic-reports"
if [ -d "$REPORT_DIR" ] && [ "$(ls -A $REPORT_DIR 2>/dev/null)" ]; then
    LATEST_REPORT=$(ls -t "$REPORT_DIR"/*.json 2>/dev/null | head -1)
    if [ -n "$LATEST_REPORT" ]; then
        echo "📄 Latest diagnostic report: $LATEST_REPORT"
        
        # Extract key information from the JSON report (requires jq if available)
        if command -v jq >/dev/null 2>&1; then
            echo ""
            echo "🎯 Key Findings:"
            
            OVERALL_HEALTH=$(jq -r '.summary.overallHealth' "$LATEST_REPORT" 2>/dev/null)
            CRITICAL_ISSUES=$(jq -r '.summary.criticalIssues' "$LATEST_REPORT" 2>/dev/null)
            FAILED_TESTS=$(jq -r '.summary.failedTests' "$LATEST_REPORT" 2>/dev/null)
            
            echo "   Overall Health: $OVERALL_HEALTH"
            echo "   Critical Issues: $CRITICAL_ISSUES"
            echo "   Failed Tests: $FAILED_TESTS"
            
            # Show recommendations if available
            RECOMMENDATIONS=$(jq -r '.recommendations[]?' "$LATEST_REPORT" 2>/dev/null | head -3)
            if [ -n "$RECOMMENDATIONS" ]; then
                echo ""
                echo "💡 Top Recommendations:"
                echo "$RECOMMENDATIONS" | sed 's/^/   - /'
            fi
        fi
    fi
fi

echo ""
echo "🔧 Next Steps:"
echo "   1. Review the diagnostic report for detailed findings"
echo "   2. Address any critical issues identified"
echo "   3. Ensure account has sufficient HBAR balance"
echo "   4. Verify token permissions and configuration"
echo "   5. Re-run specific tests after making changes"

echo ""
echo "📚 Additional Help:"
echo "   - Check the CLI README: src/cli/README.md"
echo "   - Run with --verbose for detailed logs"
echo "   - Review Hedera documentation for network-specific issues"

echo ""
echo "✅ Troubleshooting workflow completed!"