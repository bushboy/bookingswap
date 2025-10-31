import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { ProposalValidationFeedback, ProposalValidationSuccess } from '../ui/ProposalValidationFeedback';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useAriaLiveRegion } from '../../hooks/useAccessibility';
import { useId } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProposalValidation, useFieldValidation, useCompatibilityWarnings } from '../../hooks/useProposalValidation';
import {
  ProposalCreationFormProps,
  ProposalFormData,
  EligibleSwap,
  CompatibilityAnalysis,
  SwapWithProposalInfo
} from '@booking-swap/shared';
import { validateProposalConditions } from '../../utils/proposalValidation';
import { aria } from '@/utils/accessibility';

export const ProposalCreationForm: React.FC<ProposalCreationFormProps> = ({
  targetSwap,
  eligibleSwaps,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const { isMobile, isTablet } = useResponsive();
  const { announce } = useAriaLiveRegion();
  const { user } = useAuth();
  const formId = useId('proposal-form');

  const [formData, setFormData] = useState<ProposalFormData>({
    selectedSwapId: eligibleSwaps[0]?.id || '',
    message: '',
    conditions: [],
    agreedToTerms: false,
  });

  // Debug logs (safe - do not reference variables before initialization)
  console.log('ProposalCreationForm - eligibleSwaps:', eligibleSwaps);
  console.log('ProposalCreationForm - formData.selectedSwapId:', formData.selectedSwapId);
  console.log('ProposalCreationForm - targetSwap:', targetSwap);
  console.log('ProposalCreationForm - formData:', formData);
  console.log('ProposalCreationForm - user.id:', user?.id);

  // Update form data when eligibleSwaps changes
  useEffect(() => {
    if (eligibleSwaps.length > 0 && !formData.selectedSwapId) {
      console.log('ProposalCreationForm - Updating selectedSwapId to first eligible swap:', eligibleSwaps[0].id);
      setFormData(prev => ({
        ...prev,
        selectedSwapId: eligibleSwaps[0].id
      }));
    }
  }, [eligibleSwaps, formData.selectedSwapId]);

  const [showComparison, setShowComparison] = useState(true);
  const [customCondition, setCustomCondition] = useState('');
  const [compatibility, setCompatibility] = useState<CompatibilityAnalysis | null>(null);
  const [conditionValidation, setConditionValidation] = useState<{
    validConditions: string[];
    invalidConditions: Array<{ condition: string; reason: string }>;
    warnings: string[];
  }>({ validConditions: [], invalidConditions: [], warnings: [] });

  // Real-time validation hooks
  const {
    errors,
    isValid,
    isValidating,
    eligibilityCheck,
    canCreateProposal,
    compatibilityValidation,
    validateForm,
    validateField,
    getCriticalError,
    getFieldError,
    hasErrors
  } = useProposalValidation(
    eligibleSwaps,
    targetSwap,
    user?.id || '', // Use actual user ID from auth context
    compatibility,
    { enableRealTimeValidation: true, debounceDelay: 300 }
  );

  // Field-specific validation hooks
  const messageValidation = useFieldValidation('message', eligibleSwaps, 300);
  const swapValidation = useFieldValidation('selectedSwapId', eligibleSwaps, 100);

  const selectedSwap = eligibleSwaps.find(swap => swap.id === formData.selectedSwapId);

  // Compatibility warnings
  const compatibilityWarnings = useCompatibilityWarnings(
    compatibility,
    selectedSwap
  );

  // Predefined condition options
  const commonConditions = [
    'Flexible check-in/check-out times',
    'Pet-friendly accommodation required',
    'Non-smoking accommodation only',
    'Ground floor access needed',
    'Kitchen facilities required',
    'Parking space included',
    'WiFi access essential',
    'Quiet location preferred',
  ];

  useEffect(() => {
    if (selectedSwap?.compatibilityScore !== undefined) {
      // Mock compatibility analysis - in real app this would come from API
      setCompatibility({
        overallScore: selectedSwap.compatibilityScore,
        factors: {
          locationCompatibility: {
            score: Math.min(100, selectedSwap.compatibilityScore + 10),
            weight: 0.3,
            details: 'Location compatibility analysis',
            status: selectedSwap.compatibilityScore >= 80 ? 'excellent' :
              selectedSwap.compatibilityScore >= 60 ? 'good' : 'fair'
          },
          dateCompatibility: {
            score: Math.min(100, selectedSwap.compatibilityScore + 5),
            weight: 0.25,
            details: 'Date overlap analysis',
            status: selectedSwap.compatibilityScore >= 80 ? 'excellent' :
              selectedSwap.compatibilityScore >= 60 ? 'good' : 'fair'
          },
          valueCompatibility: {
            score: selectedSwap.compatibilityScore,
            weight: 0.2,
            details: 'Value comparison analysis',
            status: selectedSwap.compatibilityScore >= 80 ? 'excellent' :
              selectedSwap.compatibilityScore >= 60 ? 'good' : 'fair'
          },
          accommodationCompatibility: {
            score: Math.min(100, selectedSwap.compatibilityScore - 5),
            weight: 0.15,
            details: 'Accommodation type compatibility',
            status: selectedSwap.compatibilityScore >= 80 ? 'excellent' :
              selectedSwap.compatibilityScore >= 60 ? 'good' : 'fair'
          },
          guestCompatibility: {
            score: Math.min(100, selectedSwap.compatibilityScore + 15),
            weight: 0.1,
            details: 'Guest count compatibility',
            status: selectedSwap.compatibilityScore >= 80 ? 'excellent' :
              selectedSwap.compatibilityScore >= 60 ? 'good' : 'fair'
          },
        },
        recommendations: [
          'Both locations are in popular tourist areas',
          'Date ranges have good overlap potential',
          'Similar accommodation values'
        ],
        potentialIssues: selectedSwap.compatibilityScore < 60 ? [
          'Significant value difference may require negotiation',
          'Location preferences may not align perfectly'
        ] : []
      });
    }
  }, [selectedSwap]);

  // Real-time validation on form data changes
  useEffect(() => {
    if (formData.selectedSwapId || formData.message || formData.conditions.length > 0) {
      validateForm(formData);
    }
  }, [formData, validateForm]);

  // Validate conditions when they change
  useEffect(() => {
    const validation = validateProposalConditions(formData.conditions);
    setConditionValidation(validation);
  }, [formData.conditions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('ProposalCreationForm - handleSubmit called with formData:', formData);
    console.log('ProposalCreationForm - selectedSwap:', selectedSwap);

    const isFormValid = await validateForm(formData);
    if (!isFormValid || !canCreateProposal) {
      const criticalError = getCriticalError();
      console.log('ProposalCreationForm - Form validation failed:', { isFormValid, canCreateProposal, criticalError });
      announce(criticalError || 'Please fix the form errors before submitting', 'assertive');
      return;
    }

    // Final validation of conditions
    if (conditionValidation.invalidConditions.length > 0) {
      console.log('ProposalCreationForm - Invalid conditions:', conditionValidation.invalidConditions);
      announce('Please remove or fix invalid conditions before submitting', 'assertive');
      return;
    }

    console.log('ProposalCreationForm - Calling onSubmit with formData:', formData);
    onSubmit(formData);
  };

  const handleConditionToggle = (condition: string) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.includes(condition)
        ? prev.conditions.filter(c => c !== condition)
        : [...prev.conditions, condition]
    }));
  };

  const handleAddCustomCondition = () => {
    if (customCondition.trim() && !formData.conditions.includes(customCondition.trim())) {
      setFormData(prev => ({
        ...prev,
        conditions: [...prev.conditions, customCondition.trim()]
      }));
      setCustomCondition('');
      announce(`Added condition: ${customCondition.trim()}`, 'polite');
    }
  };

  const handleRemoveCondition = (condition: string) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c !== condition)
    }));
    announce(`Removed condition: ${condition}`, 'polite');
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getCompatibilityColor = (score: number): string => {
    if (score >= 80) return tokens.colors.success[500];
    if (score >= 60) return tokens.colors.warning[500];
    return tokens.colors.error[500];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'excellent': return tokens.colors.success[500];
      case 'good': return tokens.colors.success[400];
      case 'fair': return tokens.colors.warning[500];
      case 'poor': return tokens.colors.error[500];
      default: return tokens.colors.neutral[500];
    }
  };

  return (
    <form onSubmit={handleSubmit} id={formId}>
      {/* Swap Comparison Section */}
      {showComparison && selectedSwap && (
        <div style={{ marginBottom: tokens.spacing[6] }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: tokens.spacing[4],
          }}>
            <h3 style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[900],
              margin: 0,
            }}>
              Swap Comparison
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
              aria-label={showComparison ? 'Hide comparison' : 'Show comparison'}
            >
              {showComparison ? '👁️ Hide' : '👁️ Show'}
            </Button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr',
            gap: tokens.spacing[4],
            alignItems: 'start',
          }}>
            {/* Your Swap */}
            <Card variant="outlined" style={{ backgroundColor: tokens.colors.primary[50] }}>
              <CardHeader style={{ padding: `${tokens.spacing[3]} ${tokens.spacing[4]} ${tokens.spacing[2]}` }}>
                <h4 style={{
                  fontSize: tokens.typography.fontSize.base,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.primary[700],
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                }}>
                  <span>🏠</span> Your Swap
                </h4>
              </CardHeader>
              <CardContent style={{ padding: `0 ${tokens.spacing[4]} ${tokens.spacing[4]}` }}>
                <h5 style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[900],
                  margin: `0 0 ${tokens.spacing[2]} 0`,
                }}>
                  {selectedSwap.title}
                </h5>
                <div style={{
                  display: 'grid',
                  gap: tokens.spacing[1],
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}>
                  <div>📍 {typeof selectedSwap.bookingDetails.location === 'string' ? selectedSwap.bookingDetails.location : `${selectedSwap.bookingDetails.location?.city || 'Unknown'}, ${selectedSwap.bookingDetails.location?.country || 'Unknown'}`}</div>
                  <div>🏠 {selectedSwap.bookingDetails.accommodationType}</div>
                  <div>👥 {selectedSwap.bookingDetails.guests} guests</div>
                  <div>💰 {formatCurrency(selectedSwap.bookingDetails.estimatedValue)}</div>
                </div>
              </CardContent>
            </Card>

            {/* Exchange Arrow */}
            {!isMobile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: tokens.spacing[4],
              }}>
                <div style={{
                  fontSize: '24px',
                  color: tokens.colors.primary[500],
                  animation: 'pulse 2s infinite',
                }}>
                  ⇄
                </div>
              </div>
            )}

            {/* Target Swap */}
            <Card variant="outlined" style={{ backgroundColor: tokens.colors.neutral[50] }}>
              <CardHeader style={{ padding: `${tokens.spacing[3]} ${tokens.spacing[4]} ${tokens.spacing[2]}` }}>
                <h4 style={{
                  fontSize: tokens.typography.fontSize.base,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[700],
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                }}>
                  <span>🎯</span> Their Swap
                </h4>
              </CardHeader>
              <CardContent style={{ padding: `0 ${tokens.spacing[4]} ${tokens.spacing[4]}` }}>
                <h5 style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[900],
                  margin: `0 0 ${tokens.spacing[2]} 0`,
                }}>
                  {(targetSwap as any).sourceBooking?.title || 'Target Swap'}
                </h5>
                <div style={{
                  display: 'grid',
                  gap: tokens.spacing[1],
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}>
                  <div>📍 {typeof (targetSwap as any).sourceBooking?.location === 'string' ? (targetSwap as any).sourceBooking.location : (targetSwap as any).sourceBooking?.location?.city && (targetSwap as any).sourceBooking?.location?.country ? `${(targetSwap as any).sourceBooking.location.city}, ${(targetSwap as any).sourceBooking.location.country}` : 'Location not specified'}</div>
                  <div>🏠 {(targetSwap as any).sourceBooking?.type || 'Type not specified'}</div>
                  <div>👥 {(targetSwap as any).sourceBooking?.guests || 'N/A'} guests</div>
                  <div>💰 {formatCurrency((targetSwap as any).sourceBooking?.swapValue || 0)}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compatibility Analysis */}
          {compatibility && (
            <Card variant="outlined" style={{ marginTop: tokens.spacing[4] }}>
              <CardHeader style={{ padding: `${tokens.spacing[3]} ${tokens.spacing[4]} ${tokens.spacing[2]}` }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <h4 style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: 0,
                  }}>
                    Compatibility Analysis
                  </h4>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                    backgroundColor: `${getCompatibilityColor(compatibility.overallScore)}20`,
                    borderRadius: tokens.borderRadius.full,
                    border: `1px solid ${getCompatibilityColor(compatibility.overallScore)}`,
                  }}>
                    <span style={{
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: getCompatibilityColor(compatibility.overallScore),
                    }}>
                      {compatibility.overallScore}%
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent style={{ padding: `0 ${tokens.spacing[4]} ${tokens.spacing[4]}` }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                  gap: tokens.spacing[3],
                }}>
                  {Object.entries(compatibility.factors).map(([key, factor]) => (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${getStatusColor(factor.status)}20`,
                      }}
                    >
                      <span style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[700],
                        textTransform: 'capitalize',
                      }}>
                        {key.replace('Compatibility', '').replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                      }}>
                        <span style={{
                          fontSize: tokens.typography.fontSize.sm,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: getStatusColor(factor.status),
                        }}>
                          {factor.score}%
                        </span>
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: getStatusColor(factor.status),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {compatibility.recommendations.length > 0 && (
                  <div style={{ marginTop: tokens.spacing[4] }}>
                    <h5 style={{
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.success[700],
                      margin: `0 0 ${tokens.spacing[2]} 0`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                    }}>
                      <span>✅</span> Recommendations
                    </h5>
                    <ul style={{
                      margin: 0,
                      paddingLeft: tokens.spacing[4],
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[700],
                    }}>
                      {compatibility.recommendations.map((rec, index) => (
                        <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {compatibility.potentialIssues.length > 0 && (
                  <div style={{ marginTop: tokens.spacing[4] }}>
                    <h5 style={{
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.warning[700],
                      margin: `0 0 ${tokens.spacing[2]} 0`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                    }}>
                      <span>⚠️</span> Potential Issues
                    </h5>
                    <ul style={{
                      margin: 0,
                      paddingLeft: tokens.spacing[4],
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[700],
                    }}>
                      {compatibility.potentialIssues.map((issue, index) => (
                        <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Swap Selection Dropdown */}
      {eligibleSwaps.length > 1 && (
        <div style={{ marginBottom: tokens.spacing[6] }}>
          <label
            htmlFor={`${formId}-swap-select`}
            style={{
              display: 'block',
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[2],
            }}
          >
            Select Your Swap to Propose
          </label>
          <select
            id={`${formId}-swap-select`}
            value={formData.selectedSwapId}
            onChange={(e) => {
              const newValue = e.target.value;
              setFormData(prev => ({ ...prev, selectedSwapId: newValue }));
              // Real-time validation for swap selection
              swapValidation.validate(newValue, { ...formData, selectedSwapId: newValue });
            }}
            onBlur={() => {
              swapValidation.validate(formData.selectedSwapId, formData);
            }}
            style={{
              width: '100%',
              padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
              border: `1px solid ${swapValidation.error || getFieldError('selectedSwapId')
                ? tokens.colors.error[300]
                : swapValidation.isValidating
                  ? tokens.colors.primary[300]
                  : tokens.colors.neutral[300]
                }`,
              borderRadius: tokens.borderRadius.md,
              fontSize: tokens.typography.fontSize.base,
              backgroundColor: 'white',
              minHeight: '44px',
            }}
            aria-describedby={
              swapValidation.error || getFieldError('selectedSwapId')
                ? `${formId}-swap-error`
                : undefined
            }
            aria-invalid={!!(swapValidation.error || getFieldError('selectedSwapId'))}
          >
            <option value="">Choose a swap...</option>
            {eligibleSwaps.map((swap) => (
              <option key={swap.id} value={swap.id}>
                {swap.title} - {typeof swap.bookingDetails.location === 'string' ? swap.bookingDetails.location : `${swap.bookingDetails.location?.city || 'Unknown'}, ${swap.bookingDetails.location?.country || 'Unknown'}`} ({formatCurrency(swap.bookingDetails.estimatedValue)})
              </option>
            ))}
          </select>
          {(swapValidation.error || getFieldError('selectedSwapId')) && (
            <div
              id={`${formId}-swap-error`}
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.error[600],
                marginTop: tokens.spacing[1],
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
              }}
              role="alert"
            >
              <span>⚠️</span>
              <span>{swapValidation.error || getFieldError('selectedSwapId')}</span>
            </div>
          )}

          {swapValidation.isValidating && (
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.primary[600],
                marginTop: tokens.spacing[1],
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
              }}
            >
              <span>🔄</span>
              <span>Checking compatibility...</span>
            </div>
          )}
        </div>
      )}

      {/* Message Input */}
      <div style={{ marginBottom: tokens.spacing[6] }}>
        <label
          htmlFor={`${formId}-message`}
          style={{
            display: 'block',
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.neutral[700],
            marginBottom: tokens.spacing[2],
          }}
        >
          Message (Optional)
        </label>
        <textarea
          id={`${formId}-message`}
          value={formData.message}
          onChange={(e) => {
            const newValue = e.target.value;
            setFormData(prev => ({ ...prev, message: newValue }));
            // Real-time validation for message field
            messageValidation.validate(newValue, formData);
          }}
          onBlur={() => {
            // Validate on blur for immediate feedback
            messageValidation.validate(formData.message, formData);
          }}
          placeholder="Add a personal message to explain why this would be a great swap..."
          rows={4}
          maxLength={500}
          style={{
            width: '100%',
            padding: tokens.spacing[3],
            border: `1px solid ${messageValidation.error || getFieldError('message')
              ? tokens.colors.error[300]
              : messageValidation.isValidating
                ? tokens.colors.primary[300]
                : tokens.colors.neutral[300]
              }`,
            borderRadius: tokens.borderRadius.md,
            fontSize: tokens.typography.fontSize.base,
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '100px',
          }}
          aria-describedby={`${formId}-message-help ${messageValidation.error || getFieldError('message') ? `${formId}-message-error` : ''
            }`}
          aria-invalid={!!(messageValidation.error || getFieldError('message'))}
        />
        <div
          id={`${formId}-message-help`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: tokens.typography.fontSize.xs,
            color: tokens.colors.neutral[500],
            marginTop: tokens.spacing[1],
          }}
        >
          <span>Help the other person understand why this swap would work well</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
            {messageValidation.isValidating && (
              <span style={{ color: tokens.colors.primary[500] }}>Validating...</span>
            )}
            <span style={{
              color: formData.message.length > 450 ? tokens.colors.warning[500] : 'inherit'
            }}>
              {formData.message.length}/500
            </span>
          </div>
        </div>
        {(messageValidation.error || getFieldError('message')) && (
          <div
            id={`${formId}-message-error`}
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.error[600],
              marginTop: tokens.spacing[1],
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[2],
            }}
            role="alert"
          >
            <span>⚠️</span>
            <span>{messageValidation.error || getFieldError('message')}</span>
          </div>
        )}
      </div>

      {/* Conditions Section */}
      <div style={{ marginBottom: tokens.spacing[6] }}>
        <h4 style={{
          fontSize: tokens.typography.fontSize.base,
          fontWeight: tokens.typography.fontWeight.semibold,
          color: tokens.colors.neutral[900],
          margin: `0 0 ${tokens.spacing[3]} 0`,
        }}>
          Special Conditions (Optional)
        </h4>
        <p style={{
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.neutral[600],
          margin: `0 0 ${tokens.spacing[4]} 0`,
        }}>
          Select any special requirements or conditions for this swap:
        </p>

        {/* Common Conditions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: tokens.spacing[2],
          marginBottom: tokens.spacing[4],
        }}>
          {commonConditions.map((condition) => (
            <label
              key={condition}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                padding: tokens.spacing[2],
                cursor: 'pointer',
                borderRadius: tokens.borderRadius.md,
                transition: 'background-color 0.2s ease',
                backgroundColor: formData.conditions.includes(condition)
                  ? tokens.colors.primary[50]
                  : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={formData.conditions.includes(condition)}
                onChange={() => handleConditionToggle(condition)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: tokens.colors.primary[500],
                }}
              />
              <span style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[700],
              }}>
                {condition}
              </span>
            </label>
          ))}
        </div>

        {/* Custom Condition Input */}
        <div style={{
          display: 'flex',
          gap: tokens.spacing[2],
          alignItems: 'flex-end',
        }}>
          <div style={{ flex: 1 }}>
            <label
              htmlFor={`${formId}-custom-condition`}
              style={{
                display: 'block',
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[1],
              }}
            >
              Add Custom Condition
            </label>
            <Input
              id={`${formId}-custom-condition`}
              value={customCondition}
              onChange={(e) => setCustomCondition(e.target.value)}
              placeholder="Enter a custom condition..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomCondition();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleAddCustomCondition}
            disabled={!customCondition.trim()}
            style={{ minHeight: '44px' }}
          >
            Add
          </Button>
        </div>

        {/* Selected Conditions */}
        {formData.conditions.length > 0 && (
          <div style={{ marginTop: tokens.spacing[4] }}>
            <h5 style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              margin: `0 0 ${tokens.spacing[2]} 0`,
            }}>
              Selected Conditions:
            </h5>

            {/* Valid Conditions */}
            {conditionValidation.validConditions.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: tokens.spacing[2],
                marginBottom: tokens.spacing[2],
              }}>
                {conditionValidation.validConditions.map((condition) => (
                  <div
                    key={condition}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                      padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                      backgroundColor: tokens.colors.success[100],
                      borderRadius: tokens.borderRadius.full,
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.success[700],
                      border: `1px solid ${tokens.colors.success[200]}`,
                    }}
                  >
                    <span>✅</span>
                    <span>{condition}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(condition)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: tokens.colors.success[600],
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '14px',
                        lineHeight: 1,
                      }}
                      aria-label={`Remove condition: ${condition}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Invalid Conditions */}
            {conditionValidation.invalidConditions.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: tokens.spacing[2],
                marginBottom: tokens.spacing[2],
              }}>
                {conditionValidation.invalidConditions.map(({ condition, reason }) => (
                  <div
                    key={condition}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                      padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                      backgroundColor: tokens.colors.error[100],
                      borderRadius: tokens.borderRadius.full,
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.error[700],
                      border: `1px solid ${tokens.colors.error[200]}`,
                    }}
                    title={reason}
                  >
                    <span>❌</span>
                    <span>{condition}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(condition)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: tokens.colors.error[600],
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '14px',
                        lineHeight: 1,
                      }}
                      aria-label={`Remove invalid condition: ${condition}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Condition Warnings */}
            {conditionValidation.warnings.length > 0 && (
              <div style={{
                padding: tokens.spacing[2],
                backgroundColor: tokens.colors.warning[50],
                border: `1px solid ${tokens.colors.warning[200]}`,
                borderRadius: tokens.borderRadius.md,
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.warning[700],
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                  <span>💡</span>
                  <div>
                    {conditionValidation.warnings.map((warning, index) => (
                      <div key={index}>{warning}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Validation Feedback */}
      <ProposalValidationFeedback
        errors={errors}
        eligibilityCheck={eligibilityCheck}
        compatibility={compatibility}
        showCompatibilityWarnings={true}
        className={`${tokens.spacing[6]} 0`}
      />

      {/* Success Feedback */}
      {isValid && canCreateProposal && compatibility && (
        <ProposalValidationSuccess
          compatibility={compatibility}
          eligibleSwapsCount={eligibleSwaps.length}
          className={`${tokens.spacing[6]} 0`}
        />
      )}

      {/* Terms Agreement */}
      <div style={{ marginBottom: tokens.spacing[6] }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: tokens.spacing[3],
            cursor: 'pointer',
            padding: tokens.spacing[3],
            border: `1px solid ${getFieldError('agreedToTerms')
              ? tokens.colors.error[300]
              : formData.agreedToTerms
                ? tokens.colors.success[300]
                : tokens.colors.neutral[200]
              }`,
            borderRadius: tokens.borderRadius.md,
            backgroundColor: formData.agreedToTerms
              ? tokens.colors.success[50]
              : tokens.colors.neutral[50],
          }}
        >
          <input
            type="checkbox"
            checked={formData.agreedToTerms}
            onChange={(e) => setFormData(prev => ({ ...prev, agreedToTerms: e.target.checked }))}
            style={{
              width: '18px',
              height: '18px',
              accentColor: tokens.colors.primary[500],
            }}
            aria-describedby={getFieldError('agreedToTerms') ? `${formId}-terms-error` : undefined}
            aria-invalid={!!getFieldError('agreedToTerms')}
          />
          <div>
            <span style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[700],
              lineHeight: 1.5,
            }}>
              I agree to the{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: tokens.colors.primary[600],
                  textDecoration: 'underline',
                }}
              >
                Terms and Conditions
              </a>{' '}
              and{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: tokens.colors.primary[600],
                  textDecoration: 'underline',
                }}
              >
                Privacy Policy
              </a>
              . I understand that this proposal will be recorded on the blockchain and cannot be modified once submitted.
            </span>

            {getFieldError('agreedToTerms') && (
              <div
                id={`${formId}-terms-error`}
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.error[600],
                  marginTop: tokens.spacing[1],
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[1],
                }}
                role="alert"
              >
                <span>⚠️</span>
                <span>{getFieldError('agreedToTerms')}</span>
              </div>
            )}
          </div>
        </label>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: tokens.spacing[3],
        justifyContent: 'flex-end',
        paddingTop: tokens.spacing[4],
        borderTop: `1px solid ${tokens.colors.neutral[200]}`,
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onCancel}
          style={{ flex: isMobile ? '1' : 'none', minHeight: '44px' }}
        >
          Back to Selection
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!canCreateProposal || loading || isValidating || conditionValidation.invalidConditions.length > 0}
          loading={loading || isValidating}
          style={{
            flex: isMobile ? '1' : 'none',
            minHeight: '44px',
            opacity: canCreateProposal && !loading && !isValidating ? 1 : 0.6
          }}
        >
          {loading || isValidating ? 'Validating...' :
            !canCreateProposal ? 'Cannot Submit' :
              conditionValidation.invalidConditions.length > 0 ? 'Fix Conditions' :
                'Submit Proposal'}
        </Button>
      </div>
    </form>
  );
};
