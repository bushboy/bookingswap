import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { SwapWithBookings, SwapStatus } from '../../services/swapService';
import { BookingType } from '@booking-swap/shared';

// Step 5: Add BookingType import
export const SwapCard: React.FC<{
  swap: SwapWithBookings;
  userRole: string;
}> = ({ swap, userRole }) => {
  return (
    <Card>
      <CardHeader>Step 5: With BookingType import</CardHeader>
      <CardContent style={{ color: tokens.colors.primary[600] }}>
        User role: {userRole}, Status: {swap.status}
      </CardContent>
      <CardFooter>
        <Button>Test Button</Button>
      </CardFooter>
    </Card>
  );
};
