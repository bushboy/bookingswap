import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { tokens } from '@/design-system/tokens';
import { WALLET_CONFIG } from '../../tests/fixtures/wallet-config';

export const ProfilePage: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    location: 'New York, NY',
  });
  const headerStyles = {
    marginBottom: tokens.spacing[6],
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const profileGridStyles = {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: tokens.spacing[6],
  };

  const avatarStyles = {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    backgroundColor: tokens.colors.primary[100],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.typography.fontSize['4xl'],
    color: tokens.colors.primary[600],
    marginBottom: tokens.spacing[4],
  };

  const formGridStyles = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacing[4],
    marginBottom: tokens.spacing[6],
  };

  const fullWidthStyles = {
    gridColumn: '1 / -1',
  };

  const reputationStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[4],
  };

  const starStyles = {
    color: tokens.colors.warning[500],
    fontSize: tokens.typography.fontSize.lg,
  };

  const badgeStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
    borderRadius: tokens.borderRadius.full,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: tokens.colors.primary[100],
    color: tokens.colors.primary[800],
    marginRight: tokens.spacing[2],
    marginBottom: tokens.spacing[2],
  };

  const statItemStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacing[3]} 0`,
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const statLabelStyles = {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.neutral[600],
  };

  const statValueStyles = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
  };

  return (
    <div>
      <div style={headerStyles}>
        <h1 style={titleStyles}>Profile Settings</h1>
      </div>

      <div style={profileGridStyles}>
        <Card variant="outlined">
          <CardContent style={{ textAlign: 'center' }}>
            <div style={avatarStyles}>👤</div>
            <h2
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                marginBottom: tokens.spacing[2],
              }}
            >
              John Doe
            </h2>
            <p
              style={{
                color: tokens.colors.neutral[600],
                marginBottom: tokens.spacing[4],
              }}
            >
              Member since December 2024
            </p>

            <div style={reputationStyles}>
              <div style={{ display: 'flex' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <span key={star} style={starStyles}>
                    ★
                  </span>
                ))}
              </div>
              <span
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}
              >
                4.8 (24 reviews)
              </span>
            </div>

            <div style={{ marginBottom: tokens.spacing[4] }}>
              <span style={badgeStyles}>✅ Verified User</span>
              <span style={badgeStyles}>🏆 Top Swapper</span>
            </div>

            <Button
              variant="outline"
              style={{ width: '100%' }}
              onClick={() => {
                // TODO: Implement avatar upload
                alert('Avatar upload functionality coming soon!');
              }}
            >
              Change Avatar
            </Button>
          </CardContent>
        </Card>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[6],
          }}
        >
          <Card variant="outlined">
            <CardHeader>
              <h2
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  margin: 0,
                }}
              >
                Personal Information
              </h2>
            </CardHeader>
            <CardContent>
              <div style={formGridStyles}>
                <Input
                  label="First Name"
                  value={formData.firstName}
                  onChange={e =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  disabled={!isEditing}
                />
                <Input
                  label="Last Name"
                  value={formData.lastName}
                  onChange={e =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  disabled={!isEditing}
                />
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={e =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={!isEditing}
                  style={fullWidthStyles}
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={formData.phone}
                  onChange={e =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  disabled={!isEditing}
                />
                <Input
                  label="Location"
                  value={formData.location}
                  onChange={e =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </div>
              <div style={{ display: 'flex', gap: tokens.spacing[3] }}>
                {!isEditing ? (
                  <Button variant="primary" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => {
                        // TODO: Implement save functionality
                        console.log('Saving profile:', formData);
                        setIsEditing(false);
                        alert('Profile updated successfully!');
                      }}
                    >
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <h2
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  margin: 0,
                }}
              >
                Wallet Information
              </h2>
            </CardHeader>
            <CardContent>
              <div style={{ marginBottom: tokens.spacing[4] }}>
                <label
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[2],
                    display: 'block',
                  }}
                >
                  Wallet Address
                </label>
                <div
                  style={{
                    padding: tokens.spacing[3],
                    backgroundColor: tokens.colors.neutral[100],
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.sm,
                    fontFamily: 'JetBrains Mono, monospace',
                    wordBreak: 'break-all' as const,
                  }}
                >
                  {WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT}
                </div>
              </div>
              <div style={{ display: 'flex', gap: tokens.spacing[3] }}>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (
                      confirm(
                        'Are you sure you want to disconnect your wallet?'
                      )
                    ) {
                      // TODO: Implement wallet disconnect
                      console.log('Disconnecting wallet...');
                      alert('Wallet disconnected successfully!');
                    }
                  }}
                >
                  Disconnect Wallet
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    window.open(
                      `https://hashscan.io/testnet/account/${WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT}`,
                      '_blank'
                    )
                  }
                >
                  View on Explorer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card variant="outlined" style={{ marginTop: tokens.spacing[6] }}>
        <CardHeader>
          <h2
            style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              margin: 0,
            }}
          >
            Account Statistics
          </h2>
        </CardHeader>
        <CardContent>
          <div>
            <div style={statItemStyles}>
              <span style={statLabelStyles}>Total Swaps Completed</span>
              <span style={statValueStyles}>24</span>
            </div>
            <div style={statItemStyles}>
              <span style={statLabelStyles}>Success Rate</span>
              <span style={statValueStyles}>96%</span>
            </div>
            <div style={statItemStyles}>
              <span style={statLabelStyles}>Average Response Time</span>
              <span style={statValueStyles}>2.3 hours</span>
            </div>
            <div style={statItemStyles}>
              <span style={statLabelStyles}>Total Value Exchanged</span>
              <span style={statValueStyles}>$18,450</span>
            </div>
            <div style={{ ...statItemStyles, borderBottom: 'none' }}>
              <span style={statLabelStyles}>Account Level</span>
              <span style={statValueStyles}>Premium</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
