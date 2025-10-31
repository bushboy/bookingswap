import React from 'react';
import { tokens } from '../../design-system/tokens';
import { 
  ProposalValidationErrors, 
  EligibilityCheckResult,
  CompatibilityAnalysis,
  COMPATIBILITY_THRESHOLDS 
} from '../../utils/proposalValidation';

interface ProposalValidationFeedbackProps {
  errors: ProposalValidationErrors;
  eligibilityCheck?: EligibilityCheckResult;
  compatibility?: CompatibilityAnalysis;
  showCompatibilityWarnings?: boolean;
  className?: string;
}

export const ProposalValidationFeedback: React.FC<ProposalValidationFeedbackProps> = ({
  errors,
  eligibilityCheck,
  compatibility,
  showCompatibilityWarnings = true,
  className = ''
}) => {
  const hasErrors = Object.values(errors).some(error => error);
  const hasWarnings = eligibilityCheck?.warnings.length || 
    (compatibility && compatibility.overallScore < COMPATIBILITY_THRESHOLDS.GOOD);

  if (!hasErrors && !hasWarnings) {
    return null;
  }

  const getCompatibilityColor = (score: number): string => {
    if (score >= COMPATIBILITY_THRESHOLDS.EXCELLENT) return tokens.colors.success[500];
    if (score >= COMPATIBILITY_THRESHOLDS.GOOD) return tokens.colors.success[400];
    if (score >= COMPATIBILITY_THRESHOLDS.FAIR) return tokens.colors.warning[500];
    return tokens.colors.error[500];
  };

  const getCompatibilityIcon = (score: number): string => {
    if (score >= COMPATIBILITY_THRESHOLDS.EXCELLENT) return '🟢';
    if (score >= COMPATIBILITY_THRESHOLDS.GOOD) return '🟡';
    if (score >= COMPATIBILITY_THRESHOLDS.FAIR) return '🟠';
    return '🔴';
  };

  return (
    <div className={className}>
      {/* Eligibility Issues */}
      {eligibilityCheck && !eligibilityCheck.isEligible && (
        <div
          style={{
            padding: tokens.spacing[4],
            backgroundColor: tokens.colors.error[50],
            border: `1px solid ${tokens.colors.error[200]}`,
            borderRadius: tokens.borderRadius.md,
            marginBottom: tokens.spacing[3],
          }}
          role="alert"
          aria-live="polite"
        >
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: tokens.spacing[3],
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>❌</span>
            <div>
              <h4 style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.error[700],
                margin: `0 0 ${tokens.spacing[2]} 0`,
              }}>
                Cannot Create Proposal
              </h4>
              <ul style={{
                margin: 0,
                paddingLeft: tokens.spacing[4],
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.error[600],
              }}>
                {eligibilityCheck.reasons.map((reason, index) => (
                  <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Form Validation Errors */}
      {hasErrors && (
        <div
          style={{
            padding: tokens.spacing[4],
            backgroundColor: tokens.colors.error[50],
            border: `1px solid ${tokens.colors.error[200]}`,
            borderRadius: tokens.borderRadius.md,
            marginBottom: tokens.spacing[3],
          }}
          role="alert"
          aria-live="polite"
        >
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: tokens.spacing[3],
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
            <div>
              <h4 style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.error[700],
                margin: `0 0 ${tokens.spacing[2]} 0`,
              }}>
                Please Fix These Issues
              </h4>
              <ul style={{
                margin: 0,
                paddingLeft: tokens.spacing[4],
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.error[600],
              }}>
                {Object.entries(errors).map(([field, error]) => 
                  error ? (
                    <li key={field} style={{ marginBottom: tokens.spacing[1] }}>
                      <strong>{field === 'selectedSwapId' ? 'Swap Selection' : 
                               field === 'agreedToTerms' ? 'Terms Agreement' :
                               field.charAt(0).toUpperCase() + field.slice(1)}:</strong> {error}
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Compatibility Warnings */}
      {showCompatibilityWarnings && compatibility && compatibility.overallScore < COMPATIBILITY_THRESHOLDS.GOOD && (
        <div
          style={{
            padding: tokens.spacing[4],
            backgroundColor: compatibility.overallScore < COMPATIBILITY_THRESHOLDS.FAIR 
              ? tokens.colors.warning[50] 
              : tokens.colors.neutral[50],
            border: `1px solid ${compatibility.overallScore < COMPATIBILITY_THRESHOLDS.FAIR 
              ? tokens.colors.warning[200] 
              : tokens.colors.neutral[200]}`,
            borderRadius: tokens.borderRadius.md,
            marginBottom: tokens.spacing[3],
          }}
          role="alert"
          aria-live="polite"
        >
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: tokens.spacing[3],
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>
              {getCompatibilityIcon(compatibility.overallScore)}
            </span>
            <div>
              <h4 style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: compatibility.overallScore < COMPATIBILITY_THRESHOLDS.FAIR 
                  ? tokens.colors.warning[700] 
                  : tokens.colors.neutral[700],
                margin: `0 0 ${tokens.spacing[2]} 0`,
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
              }}>
                Compatibility Score: 
                <span style={{ 
                  color: getCompatibilityColor(compatibility.overallScore),
                  fontWeight: tokens.typography.fontWeight.bold 
                }}>
                  {compatibility.overallScore}%
                </span>
              </h4>
              
              {compatibility.overallScore < COMPATIBILITY_THRESHOLDS.FAIR && (
                <p style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.warning[600],
                  margin: `0 0 ${tokens.spacing[3]} 0`,
                }}>
                  This proposal has low compatibility and may be less likely to be accepted.
                </p>
              )}

              {/* Factor Breakdown */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: tokens.spacing[2],
                marginBottom: tokens.spacing[3],
              }}>
                {Object.entries(compatibility.factors).map(([factorName, factor]) => (
                  <div
                    key={factorName}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                      backgroundColor: 'white',
                      borderRadius: tokens.borderRadius.sm,
                      fontSize: tokens.typography.fontSize.xs,
                    }}
                  >
                    <span style={{ color: tokens.colors.neutral[600] }}>
                      {factorName.replace('Compatibility', '').replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span style={{ 
                      color: getCompatibilityColor(factor.score),
                      fontWeight: tokens.typography.fontWeight.medium 
                    }}>
                      {factor.score}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Potential Issues */}
              {compatibility.potentialIssues.length > 0 && (
                <div>
                  <h5 style={{
                    fontSize: tokens.typography.fontSize.xs,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.warning[700],
                    margin: `0 0 ${tokens.spacing[1]} 0`,
                  }}>
                    Potential Issues:
                  </h5>
                  <ul style={{
                    margin: 0,
                    paddingLeft: tokens.spacing[4],
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.warning[600],
                  }}>
                    {compatibility.potentialIssues.map((issue, index) => (
                      <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {compatibility.recommendations.length > 0 && (
                <div style={{ marginTop: tokens.spacing[2] }}>
                  <h5 style={{
                    fontSize: tokens.typography.fontSize.xs,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.success[700],
                    margin: `0 0 ${tokens.spacing[1]} 0`,
                  }}>
                    Recommendations:
                  </h5>
                  <ul style={{
                    margin: 0,
                    paddingLeft: tokens.spacing[4],
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.success[600],
                  }}>
                    {compatibility.recommendations.map((rec, index) => (
                      <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* General Warnings */}
      {eligibilityCheck?.warnings.length && eligibilityCheck.warnings.length > 0 && (
        <div
          style={{
            padding: tokens.spacing[3],
            backgroundColor: tokens.colors.warning[50],
            border: `1px solid ${tokens.colors.warning[200]}`,
            borderRadius: tokens.borderRadius.md,
          }}
          role="alert"
          aria-live="polite"
        >
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: tokens.spacing[2],
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>💡</span>
            <div>
              <h4 style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.warning[700],
                margin: `0 0 ${tokens.spacing[1]} 0`,
              }}>
                Things to Consider
              </h4>
              <ul style={{
                margin: 0,
                paddingLeft: tokens.spacing[3],
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.warning[600],
              }}>
                {eligibilityCheck.warnings.map((warning, index) => (
                  <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Success feedback component for when validation passes
interface ProposalValidationSuccessProps {
  compatibility?: CompatibilityAnalysis;
  eligibleSwapsCount: number;
  className?: string;
}

export const ProposalValidationSuccess: React.FC<ProposalValidationSuccessProps> = ({
  compatibility,
  eligibleSwapsCount,
  className = ''
}) => {
  if (!compatibility || compatibility.overallScore < COMPATIBILITY_THRESHOLDS.GOOD) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        padding: tokens.spacing[3],
        backgroundColor: tokens.colors.success[50],
        border: `1px solid ${tokens.colors.success[200]}`,
        borderRadius: tokens.borderRadius.md,
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
      }}>
        <span style={{ fontSize: '20px' }}>✅</span>
        <div>
          <h4 style={{
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.success[700],
            margin: `0 0 ${tokens.spacing[1]} 0`,
          }}>
            Great Match! ({compatibility.overallScore}% compatibility)
          </h4>
          <p style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.success[600],
            margin: 0,
          }}>
            This proposal has excellent compatibility and is ready to submit.
          </p>
        </div>
      </div>
    </div>
  );
};