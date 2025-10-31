# Design Document

## Overview

This design enhances the SwapInfoPanel component and related swap display logic to show comprehensive, meaningful swap information wherever booking cards with swaps are displayed. The current implementation often shows empty or minimal swap details, leading to poor user experience. The solution focuses on enriching the data display without changing the overall UI architecture.

## Architecture

### Current Implementation Analysis

The existing swap display system includes:
- ✅ SwapInfoPanel component for displaying swap information
- ✅ SwapStatusBadge for quick status indicators  
- ✅ BookingCard integration with swap display toggle
- ✅ SwapInfo data structure with basic swap details

### Issues to Address

1. **Incomplete Data Display**: SwapInfoPanel doesn't show all available swap information
2. **Empty States**: When swap data is minimal, the panel appears empty or unhelpful
3. **Missing Context**: Users can't understand swap status or next steps from current display
4. **Inconsistent Information**: Different screens may show different levels of swap detail

### Enhancement Strategy

Enhance the existing SwapInfoPanel component to:
- Display comprehensive swap information from the SwapInfo data structure
- Show meaningful content for all swap states (active, pending, completed, etc.)
- Provide clear status indicators and next steps
- Maintain consistent information display across all screens

## Components to Enhance

### 1. Enhanced SwapInfoPanel Component

**Current Issues:**
```typescript
// Currently shows minimal information
<SwapInfoPanel
  swapInfo={swapInfo}
  userRole={userRole}
  compact={compact}
/>
```

**Enhanced Implementation:**
```typescript
interface EnhancedSwapInfoPanelProps {
  swapInfo: SwapInfo;
  userRole: BookingUserRole;
  compact?: boolean;
  showFullDetails?: boolean; // New prop for comprehensive display
}

const EnhancedSwapInfoPanel: React.FC<EnhancedSwapInfoPanelProps> = ({
  swapInfo,
  userRole,
  compact = false,
  showFullDetails = true
}) => {
  // Enhanced rendering logic with comprehensive information display
  return (
    <div className="enhanced-swap-info-panel">
      {/* Swap Status Section */}
      <SwapStatusSection swapInfo={swapInfo} />
      
      {/* Proposal Activity Section */}
      <ProposalActivitySection 
        swapInfo={swapInfo} 
        userRole={userRole}
        compact={compact}
      />
      
      {/* Swap Terms Section */}
      <SwapTermsSection 
        swapInfo={swapInfo}
        showFullDetails={showFullDetails}
      />
      
      {/* Action Items Section */}
      <ActionItemsSection 
        swapInfo={swapInfo}
        userRole={userRole}
      />
    </div>
  );
};
```

### 2. New Sub-Components for Organized Information Display

#### SwapStatusSection
Displays current swap status with clear indicators:

```typescript
interface SwapStatusSectionProps {
  swapInfo: SwapInfo;
}

const SwapStatusSection: React.FC<SwapStatusSectionProps> = ({ swapInfo }) => {
  const getStatusDisplay = () => {
    if (swapInfo.acceptanceStrategy === 'auction') {
      return {
        icon: '🔨',
        label: 'Auction Mode',
        status: swapInfo.timeRemaining ? 'Active' : 'Ended',
        urgency: swapInfo.timeRemaining && swapInfo.timeRemaining < 24 * 60 * 60 * 1000 ? 'high' : 'normal'
      };
    }
    
    return {
      icon: '🔄',
      label: 'First Match',
      status: swapInfo.hasActiveProposals ? 'Active' : 'Available',
      urgency: 'normal'
    };
  };

  const statusInfo = getStatusDisplay();
  
  return (
    <div className={`swap-status-section ${statusInfo.urgency}`}>
      <div className="status-header">
        <span className="status-icon">{statusInfo.icon}</span>
        <span className="status-label">{statusInfo.label}</span>
        <span className="status-value">{statusInfo.status}</span>
      </div>
      
      {swapInfo.timeRemaining && (
        <div className="time-remaining">
          <CountdownTimer timeRemaining={swapInfo.timeRemaining} />
        </div>
      )}
    </div>
  );
};
```

#### ProposalActivitySection
Shows proposal counts and activity:

```typescript
interface ProposalActivitySectionProps {
  swapInfo: SwapInfo;
  userRole: BookingUserRole;
  compact?: boolean;
}

const ProposalActivitySection: React.FC<ProposalActivitySectionProps> = ({
  swapInfo,
  userRole,
  compact
}) => {
  const getActivityDisplay = () => {
    const count = swapInfo.activeProposalCount || 0;
    
    if (userRole === 'owner') {
      if (count === 0) {
        return {
          message: 'No proposals received yet',
          icon: '📭',
          actionable: false
        };
      }
      
      return {
        message: `${count} active proposal${count > 1 ? 's' : ''} waiting for review`,
        icon: '📬',
        actionable: true,
        urgency: count > 3 ? 'high' : 'normal'
      };
    }
    
    if (userRole === 'proposer') {
      const status = swapInfo.userProposalStatus;
      return {
        message: getProposerStatusMessage(status),
        icon: getProposerStatusIcon(status),
        actionable: status === 'pending'
      };
    }
    
    // Browser role
    if (count > 0) {
      return {
        message: `${count} proposal${count > 1 ? 's' : ''} submitted`,
        icon: '👥',
        actionable: true
      };
    }
    
    return {
      message: 'Available for proposals',
      icon: '✨',
      actionable: true
    };
  };

  const activity = getActivityDisplay();
  
  return (
    <div className={`proposal-activity-section ${activity.urgency || 'normal'}`}>
      <div className="activity-indicator">
        <span className="activity-icon">{activity.icon}</span>
        <span className="activity-message">{activity.message}</span>
      </div>
      
      {!compact && activity.actionable && (
        <div className="activity-actions">
          {userRole === 'owner' && swapInfo.activeProposalCount > 0 && (
            <button className="review-proposals-btn">
              Review Proposals
            </button>
          )}
        </div>
      )}
    </div>
  );
};
```

#### SwapTermsSection
Displays comprehensive swap terms and conditions:

```typescript
interface SwapTermsSectionProps {
  swapInfo: SwapInfo;
  showFullDetails?: boolean;
}

const SwapTermsSection: React.FC<SwapTermsSectionProps> = ({
  swapInfo,
  showFullDetails = true
}) => {
  return (
    <div className="swap-terms-section">
      <div className="terms-header">
        <h4>Swap Terms</h4>
      </div>
      
      {/* Payment Types */}
      <div className="payment-types">
        <label>Accepts:</label>
        <div className="payment-type-badges">
          {(swapInfo.paymentTypes || []).map(type => (
            <span key={type} className={`payment-badge ${type}`}>
              {type === 'booking' ? '🔄 Booking Exchange' : '💰 Cash Offers'}
            </span>
          ))}
        </div>
      </div>
      
      {/* Cash Requirements */}
      {swapInfo.minCashAmount && (
        <div className="cash-requirements">
          <label>Minimum Cash:</label>
          <span className="cash-amount">
            ${swapInfo.minCashAmount.toLocaleString()}
          </span>
          {swapInfo.maxCashAmount && (
            <span className="cash-range">
              - ${swapInfo.maxCashAmount.toLocaleString()}
            </span>
          )}
        </div>
      )}
      
      {/* Swap Conditions */}
      {showFullDetails && swapInfo.swapConditions && swapInfo.swapConditions.length > 0 && (
        <div className="swap-conditions">
          <label>Conditions:</label>
          <ul className="conditions-list">
            {swapInfo.swapConditions.map((condition, index) => (
              <li key={index} className="condition-item">
                {condition}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Auction Details */}
      {swapInfo.acceptanceStrategy === 'auction' && (
        <div className="auction-details">
          <label>Auction End:</label>
          <span className="auction-end-date">
            {swapInfo.auctionEndDate ? 
              new Date(swapInfo.auctionEndDate).toLocaleDateString() : 
              'Not specified'
            }
          </span>
        </div>
      )}
    </div>
  );
};
```

#### ActionItemsSection
Shows relevant actions based on swap status:

```typescript
interface ActionItemsSectionProps {
  swapInfo: SwapInfo;
  userRole: BookingUserRole;
}

const ActionItemsSection: React.FC<ActionItemsSectionProps> = ({
  swapInfo,
  userRole
}) => {
  const getActionItems = () => {
    const actions = [];
    
    if (userRole === 'owner') {
      if (swapInfo.activeProposalCount > 0) {
        actions.push({
          label: 'Review Proposals',
          type: 'primary',
          icon: '👀'
        });
      }
      
      actions.push({
        label: 'Manage Swap',
        type: 'secondary',
        icon: '⚙️'
      });
    }
    
    if (userRole === 'browser' && swapInfo.hasActiveProposals) {
      actions.push({
        label: 'Make Proposal',
        type: 'primary',
        icon: '💌'
      });
    }
    
    if (userRole === 'proposer') {
      const status = swapInfo.userProposalStatus;
      if (status === 'pending') {
        actions.push({
          label: 'View Proposal',
          type: 'secondary',
          icon: '📄'
        });
        actions.push({
          label: 'Withdraw',
          type: 'danger',
          icon: '🗑️'
        });
      }
    }
    
    return actions;
  };

  const actions = getActionItems();
  
  if (actions.length === 0) return null;
  
  return (
    <div className="action-items-section">
      <div className="action-buttons">
        {actions.map((action, index) => (
          <button
            key={index}
            className={`action-btn ${action.type}`}
          >
            <span className="action-icon">{action.icon}</span>
            <span className="action-label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
```

### 3. Enhanced Data Processing

#### SwapInfo Data Enrichment
Ensure all necessary data is available for display:

```typescript
interface EnhancedSwapInfo extends SwapInfo {
  // Ensure all fields are properly typed and available
  swapId: string;
  paymentTypes: ('booking' | 'cash')[];
  acceptanceStrategy: 'first-match' | 'auction';
  auctionEndDate?: Date;
  minCashAmount?: number;
  maxCashAmount?: number;
  hasActiveProposals: boolean;
  activeProposalCount: number;
  userProposalStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
  timeRemaining?: number;
  swapConditions?: string[];
  
  // Additional computed fields for better display
  isUrgent?: boolean;
  nextAction?: string;
  statusSummary?: string;
}

const enrichSwapInfo = (swapInfo: SwapInfo): EnhancedSwapInfo => {
  const enhanced = { ...swapInfo } as EnhancedSwapInfo;
  
  // Compute urgency
  enhanced.isUrgent = swapInfo.timeRemaining ? 
    swapInfo.timeRemaining < 24 * 60 * 60 * 1000 : false;
  
  // Determine next action
  enhanced.nextAction = getNextAction(swapInfo);
  
  // Create status summary
  enhanced.statusSummary = createStatusSummary(swapInfo);
  
  return enhanced;
};
```

## Data Models

### Enhanced SwapInfo Interface
```typescript
interface SwapInfoDisplay {
  // Core swap information
  swapId: string;
  paymentTypes: ('booking' | 'cash')[];
  acceptanceStrategy: 'first-match' | 'auction';
  
  // Financial terms
  minCashAmount?: number;
  maxCashAmount?: number;
  
  // Timing information
  auctionEndDate?: Date;
  timeRemaining?: number;
  
  // Activity tracking
  hasActiveProposals: boolean;
  activeProposalCount: number;
  userProposalStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
  
  // Terms and conditions
  swapConditions?: string[];
  
  // Display helpers
  statusDisplay: {
    icon: string;
    label: string;
    urgency: 'low' | 'normal' | 'high';
  };
  
  activitySummary: {
    message: string;
    actionable: boolean;
    count?: number;
  };
}
```

## Styling and Visual Design

### Enhanced Swap Panel Styles
```css
.enhanced-swap-info-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-top: 12px;
}

.swap-status-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.swap-status-section.high {
  border-left: 4px solid #ef4444;
  padding-left: 12px;
}

.proposal-activity-section {
  margin-bottom: 12px;
}

.proposal-activity-section.high {
  background: #fef2f2;
  padding: 8px;
  border-radius: 4px;
  border-left: 4px solid #ef4444;
}

.swap-terms-section {
  margin-bottom: 12px;
}

.payment-type-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.payment-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.payment-badge.booking {
  background: #dbeafe;
  color: #1e40af;
}

.payment-badge.cash {
  background: #d1fae5;
  color: #065f46;
}

.cash-amount {
  font-weight: 600;
  color: #059669;
  font-size: 16px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #3b82f6;
  color: white;
}

.action-btn.secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}

.action-btn.danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
```

## Implementation Strategy

### Phase 1: Enhance SwapInfoPanel Component
1. Update SwapInfoPanel to show comprehensive information
2. Add new sub-components for organized display
3. Implement data enrichment functions
4. Add proper styling and visual hierarchy

### Phase 2: Update Integration Points
1. Ensure BookingCard passes complete SwapInfo data
2. Update all screens that display booking cards
3. Test display consistency across different user roles
4. Verify mobile responsiveness

### Phase 3: Testing and Refinement
1. Test with various swap states and data combinations
2. Verify performance with multiple bookings
3. Ensure accessibility compliance
4. Gather user feedback and iterate

## Error Handling

### Missing or Incomplete Data
```typescript
const handleMissingSwapData = (swapInfo: Partial<SwapInfo>) => {
  // Provide sensible defaults for missing data
  const safeSwapInfo: SwapInfo = {
    swapId: swapInfo.swapId || 'unknown',
    paymentTypes: swapInfo.paymentTypes || ['booking'],
    acceptanceStrategy: swapInfo.acceptanceStrategy || 'first-match',
    hasActiveProposals: swapInfo.hasActiveProposals || false,
    activeProposalCount: swapInfo.activeProposalCount || 0,
    ...swapInfo
  };
  
  return safeSwapInfo;
};
```

### Loading States
```typescript
const SwapInfoPanelWithLoading: React.FC<SwapInfoPanelProps> = (props) => {
  if (!props.swapInfo) {
    return (
      <div className="swap-info-loading">
        <div className="loading-skeleton">
          <div className="skeleton-line"></div>
          <div className="skeleton-line short"></div>
        </div>
      </div>
    );
  }
  
  return <EnhancedSwapInfoPanel {...props} />;
};
```

This design maintains the existing architecture while significantly enhancing the information display to provide users with comprehensive, actionable swap details wherever they encounter booking cards with swaps.