# Security Testing Guide

This document outlines the comprehensive security testing approach for the Booking Swap Platform.

## Overview

Our security testing strategy follows a multi-layered approach covering:

- **Static Analysis**: Code scanning for security vulnerabilities
- **Dynamic Analysis**: Runtime security testing
- **Penetration Testing**: Simulated attacks on the application
- **Dependency Scanning**: Third-party vulnerability assessment
- **Smart Contract Security**: Blockchain-specific security testing

## Security Test Categories

### 1. Authentication & Authorization Tests

**Location**: `apps/backend/tests/security/vulnerabilities/authentication.test.ts`

**Coverage**:
- JWT token security (expiration, tampering, signature validation)
- Wallet signature verification
- Session management
- Privilege escalation prevention
- Rate limiting and brute force protection
- Admin authentication security

**Key Test Cases**:
- Expired token rejection
- Invalid signature detection
- Horizontal/vertical privilege escalation
- Session invalidation on logout
- Rate limiting effectiveness

### 2. Input Validation & XSS Prevention

**Location**: `apps/backend/tests/security/vulnerabilities/input-validation.test.ts`

**Coverage**:
- Cross-site scripting (XSS) prevention
- Input length validation
- Data type validation
- Business logic validation
- File upload security
- Content Security Policy enforcement

**Key Test Cases**:
- HTML sanitization in user inputs
- Script injection prevention
- File type and size validation
- Malware detection in uploads
- CSP header validation

### 3. SQL Injection Prevention

**Location**: `apps/backend/tests/security/vulnerabilities/sql-injection.test.ts`

**Coverage**:
- Parameterized query verification
- Input sanitization
- Database error handling
- ORM security configuration

**Key Test Cases**:
- Malicious SQL payload injection
- Union-based attacks
- Time-based blind SQL injection
- Error-based information disclosure

### 4. Smart Contract Security

**Location**: `apps/backend/tests/security/vulnerabilities/smart-contract.test.ts`

**Coverage**:
- Access control vulnerabilities
- Reentrancy attack prevention
- Integer overflow/underflow protection
- Input validation in contracts
- Gas limit DoS protection
- State manipulation prevention
- Time-based attack prevention
- Contract upgrade security
- Emergency controls

**Key Test Cases**:
- Unauthorized contract execution
- Reentrancy attack simulation
- Integer arithmetic safety
- Gas consumption analysis
- State transition validation

### 5. API Security

**Location**: `apps/backend/tests/security/api-security.test.ts`

**Coverage**:
- HTTP security headers
- Request size limits
- Path traversal prevention
- Information disclosure prevention
- Rate limiting
- CORS configuration
- WebSocket security

**Key Test Cases**:
- Security header validation
- Directory traversal attempts
- Sensitive data exposure
- API versioning security
- Response caching controls

### 6. Comprehensive Security Audit

**Location**: `apps/backend/tests/security/security-audit.test.ts`

**Coverage**:
- Network security scanning
- Application vulnerability assessment
- Input validation across all endpoints
- Authentication security testing
- Data protection validation
- Business logic security
- Infrastructure security

## Running Security Tests

### Local Development

```bash
# Run all security tests
npm run test:security

# Run specific security test categories
npm run test:security:backend
npm run test:security:frontend

# Run security linting
npm run lint:security

# Run dependency vulnerability scan
npm audit --audit-level=moderate
```

### Continuous Integration

Security tests are automatically run in our CI/CD pipeline:

1. **Unit Security Tests**: Run on every commit
2. **Integration Security Tests**: Run on pull requests
3. **Comprehensive Security Audit**: Run on scheduled basis
4. **OWASP ZAP Scan**: Automated penetration testing

### Security Test Reports

The security test suite generates several reports:

- **HTML Report**: `security-report.html` - Human-readable detailed report
- **JSON Report**: `security-report.json` - Machine-readable full results
- **Summary Report**: `security-summary.json` - CI/CD integration summary

## Security Testing Tools

### Static Analysis Tools

- **ESLint Security Plugin**: Detects common security anti-patterns
- **No-Secrets Plugin**: Prevents hardcoded secrets in code
- **Semgrep**: Advanced static analysis (optional)

### Dynamic Analysis Tools

- **Custom Test Suite**: Comprehensive application security testing
- **OWASP ZAP**: Automated penetration testing
- **Supertest**: API security testing

### Dependency Scanning

- **npm audit**: Built-in Node.js vulnerability scanner
- **Snyk**: Advanced dependency vulnerability scanning (optional)

## Security Test Configuration

### ESLint Security Rules

Configuration: `.eslintrc.security.json`

Key rules enabled:
- Object injection detection
- Eval usage prevention
- File system security
- Regular expression safety
- Cryptographic security
- Secret detection

### OWASP ZAP Configuration

Configuration: `.zap/rules.tsv`

Scan categories:
- Authentication and session management
- Input validation
- Information disclosure
- Server configuration
- API security

## Security Thresholds

Our security testing enforces the following thresholds:

- **Critical Issues**: 0 allowed (CI fails)
- **High Issues**: 0 allowed (CI fails)
- **Medium Issues**: Warning only
- **Low Issues**: Informational

## Best Practices

### For Developers

1. **Run security tests locally** before committing code
2. **Review security test failures** carefully - they indicate real vulnerabilities
3. **Keep dependencies updated** to avoid known vulnerabilities
4. **Follow secure coding practices** as enforced by ESLint security rules
5. **Never commit secrets** - use environment variables

### For Security Testing

1. **Test early and often** - security is not an afterthought
2. **Cover all attack vectors** - authentication, input validation, business logic
3. **Test both positive and negative cases** - ensure security controls work
4. **Keep tests updated** - add new tests for new features and attack patterns
5. **Monitor security trends** - update tests based on new vulnerability types

## Incident Response

If security tests fail:

1. **Stop deployment** - do not deploy code with security failures
2. **Analyze the failure** - understand the vulnerability
3. **Fix the issue** - implement proper security controls
4. **Re-run tests** - verify the fix is effective
5. **Document the incident** - learn from security issues

## Security Test Maintenance

### Regular Updates

- **Monthly**: Update security testing dependencies
- **Quarterly**: Review and update security test cases
- **Annually**: Comprehensive security testing strategy review

### New Feature Testing

When adding new features:

1. **Identify security requirements** based on feature functionality
2. **Write security tests** before implementing the feature
3. **Test all security aspects** - authentication, authorization, input validation
4. **Review with security team** for complex features

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Hedera Security Best Practices](https://docs.hedera.com/guides/core-concepts/smart-contracts/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## Contact

For security-related questions or to report security issues:

- **Security Team**: security@bookingswap.com
- **Bug Bounty Program**: [Link to bug bounty program]
- **Security Documentation**: [Link to internal security docs]