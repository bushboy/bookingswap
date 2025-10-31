import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const heroStyles = {
    textAlign: 'center' as const,
    padding: `${tokens.spacing[16]} ${tokens.spacing[6]}`,
    backgroundColor: 'white',
    borderRadius: tokens.borderRadius.xl,
    marginBottom: tokens.spacing[8],
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize['4xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[4],
  };

  const subtitleStyles = {
    fontSize: tokens.typography.fontSize.xl,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[8],
    maxWidth: '600px',
    margin: `0 auto ${tokens.spacing[8]}`,
  };

  const featuresGridStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacing[6],
    marginBottom: tokens.spacing[8],
  };

  const statsStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: tokens.spacing[4],
  };

  const statCardStyles = {
    textAlign: 'center' as const,
    padding: tokens.spacing[6],
  };

  const statNumberStyles = {
    fontSize: tokens.typography.fontSize['3xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary[600],
    marginBottom: tokens.spacing[2],
  };

  const statLabelStyles = {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.neutral[600],
  };

  return (
    <div>
      <div style={heroStyles}>
        <h1 style={titleStyles}>Swap Your Bookings Securely</h1>
        <p style={subtitleStyles}>
          Exchange hotel reservations, event tickets, and travel bookings with
          other users using blockchain technology for secure, trustless
          transactions.
        </p>
        <div
          style={{
            display: 'flex',
            gap: tokens.spacing[4],
            justifyContent: 'center',
          }}
        >
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/bookings/new')}
          >
            Start Swapping
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/browse')}
          >
            Browse Swaps
          </Button>
        </div>
      </div>

      <div style={featuresGridStyles}>
        <Card variant="elevated">
          <CardHeader>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                margin: 0,
              }}
            >
              🔒 Secure Transactions
            </h3>
          </CardHeader>
          <CardContent>
            <p style={{ color: tokens.colors.neutral[600], margin: 0 }}>
              All swaps are recorded on Hedera blockchain, ensuring transparency
              and immutability. Your transactions are secure and verifiable.
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                margin: 0,
              }}
            >
              🚀 Fast & Low Cost
            </h3>
          </CardHeader>
          <CardContent>
            <p style={{ color: tokens.colors.neutral[600], margin: 0 }}>
              Powered by Hedera's efficient consensus mechanism, enjoy fast
              transaction finality with minimal fees.
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                margin: 0,
              }}
            >
              🤝 Trustless Exchange
            </h3>
          </CardHeader>
          <CardContent>
            <p style={{ color: tokens.colors.neutral[600], margin: 0 }}>
              No intermediaries needed. Smart contracts handle the exchange
              automatically when both parties agree to the swap.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card variant="outlined">
        <CardHeader>
          <h2
            style={{
              fontSize: tokens.typography.fontSize['2xl'],
              fontWeight: tokens.typography.fontWeight.bold,
              margin: 0,
              textAlign: 'center',
            }}
          >
            Platform Statistics
          </h2>
        </CardHeader>
        <CardContent>
          <div style={statsStyles}>
            <div style={statCardStyles}>
              <div style={statNumberStyles}>1,234</div>
              <div style={statLabelStyles}>Total Swaps</div>
            </div>
            <div style={statCardStyles}>
              <div style={statNumberStyles}>567</div>
              <div style={statLabelStyles}>Active Users</div>
            </div>
            <div style={statCardStyles}>
              <div style={statNumberStyles}>$89K</div>
              <div style={statLabelStyles}>Value Exchanged</div>
            </div>
            <div style={statCardStyles}>
              <div style={statNumberStyles}>98%</div>
              <div style={statLabelStyles}>Success Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
