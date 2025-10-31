# Required Dependencies for Password Reset

Add these dependencies to your backend package.json:

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## Environment Variables

Add these to your .env file:

```env
# Email Configuration (Production)
SMTP_HOST=smtp.your-email-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password
SMTP_FROM_EMAIL=noreply@bookingswap.com
SMTP_FROM_NAME=Booking Swap Platform

# Email Configuration (Development - Ethereal Email)
ETHEREAL_USER=ethereal.user@ethereal.email
ETHEREAL_PASS=ethereal.pass

# Frontend URL for password reset links
FRONTEND_URL=http://localhost:3000
```

## Database Migration

Run the migration to create the password_reset_tokens table:

```bash
# Apply the migration (adjust path as needed)
psql -d your_database -f apps/backend/src/database/migrations/018_add_password_reset_tokens.sql
```