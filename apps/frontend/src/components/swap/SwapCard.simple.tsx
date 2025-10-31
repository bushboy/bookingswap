import React from 'react';

interface SwapCardProps {
  swap: any;
  userRole: 'proposer' | 'owner';
}

export const SwapCard: React.FC<SwapCardProps> = ({ swap, userRole }) => {
  return (
    <div>
      <h3>Swap Card</h3>
      <p>Status: {swap.status}</p>
      <p>User Role: {userRole}</p>
    </div>
  );
};
