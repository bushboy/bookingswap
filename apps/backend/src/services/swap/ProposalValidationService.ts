import { 
  CreateProposalFromBrowseRequest,
  ValidationResult,
  EligibleSwap,
  CompatibilityAnalysis,
  SwapWithProposalInfo
} from '@booking-swap/shared';
import { 
  ProposalErrorFactory,
  PROPOSAL_ERROR_CODES,
  ProposalRateLimiter,
  validateProposalRequest
} from '../../utils/proposalErrorHandling';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { BookingRepository } from '../../database/repositories/BookingRepository';
import { logger } from '../../utils/logger';

export interface ProposalValidationContext {
  userId: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
}

export interface DetailedValidationResult extends ValidationResult {
  warnings: string[];
  recommendations: string[];
  compatibilityAnalysis?: CompatibilityAnalysis;
  riskFactors: Array<{
    type: 'low' | 'medium' | 'high';
    message: string;
    impact: string;
  }>;
}

export class ProposalValidationService {
  constructor(
    private swapRepository: SwapRepository,
    private bookingRepository: BookingRepository
  ) {}

  /**
   * Comprehensive validation of proposal request
   */
  async validateProposalRequest(
    request: CreateProposalFromBrowseRequest,
    context: ProposalValidationContext
  ): Promise<DetailedValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const riskFactors: Array<{ type: 'low' | 'medium' | 'high'; message: string; impact: string }> = [];

    try {
      // 1. Rate limiting check
      await this.checkRateLimit(context.userId);

      // 2. Basic field validation
      this.validateBasicFields(request);

      // 3. User authorization check
      await this.validateUserAuthorization(request, context.userId);

      // 4. Swap availability and eligibility
      const eligibilityResult = await this.validateSwapEligibility(request, context.userId);
      errors.push(...eligibilityResult.errors);
      warnings.push(...eligibilityResult.warnings);

      // 5. Compatibility analysis
      const compatibilityResult = await this.analyzeCompatibility(request);
      if (compatibilityResult.warnings.length > 0) {
        warnings.push(...compatibilityResult.warnings);
      }
      if (compatibilityResult.riskFactors.length > 0) {
        riskFactors.push(...compatibilityResult.riskFactors);
      }

      // 6. Content validation
      const contentResult = this.validateContent(request);
      errors.push(...contentResult.errors);
      warnings.push(...contentResult.warnings);

      // 7. Business rules validation
      const businessResult = await this.validateBusinessRules(request, context.userId);
      errors.push(...businessResult.errors);
      warnings.push(...businessResult.warnings);

      // 8. Generate recommendations
      recommendations.push(...this.generateRecommendations(request, compatibilityResult.analysis));

      const eligibilityChecks = {
        userOwnsSourceSwap: eligibilityResult.userOwnsSourceSwap,
        sourceSwapAvailable: eligibilityResult.sourceSwapAvailable,
        targetSwapAvailable: eligibilityResult.targetSwapAvailable,
        noExistingProposal: eligibilityResult.noExistingProposal,
        swapsAreCompatible: compatibilityResult.analysis ? 
          compatibilityResult.analysis.overallScore >= 40 : true
      };

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        recommendations,
        eligibilityChecks,
        compatibilityAnalysis: compatibilityResult.analysis,
        riskFactors
      };

    } catch (error) {
      logger.error('Proposal validation failed', { 
        error: (error as Error).message, 
        request, 
        context 
      });

      if (error instanceof Error) {
        errors.push(error.message);
      }

      return {
        isValid: false,
        errors,
        warnings,
        recommendations,
        eligibilityChecks: {
          userOwnsSourceSwap: false,
          sourceSwapAvailable: false,
          targetSwapAvailable: false,
          noExistingProposal: false,
          swapsAreCompatible: false
        },
        riskFactors
      };
    }
  }

  /**
   * Check rate limiting for proposal creation
   */
  private async checkRateLimit(userId: string): Promise<void> {
    await ProposalRateLimiter.checkRateLimit(userId, 'proposal');
  }

  /**
   * Validate basic required fields
   */
  private validateBasicFields(request: CreateProposalFromBrowseRequest): void {
    validateProposalRequest(request);
  }

  /**
   * Validate user authorization
   */
  private async validateUserAuthorization(
    request: CreateProposalFromBrowseRequest,
    userId: string
  ): Promise<void> {
    if (request.proposerId !== userId) {
      throw ProposalErrorFactory.createEligibilityError(
        PROPOSAL_ERROR_CODES.USER_NOT_AUTHORIZED,
        request.sourceSwapId,
        request.targetSwapId,
        userId,
        'Proposer ID does not match authenticated user'
      );
    }
  }

  /**
   * Validate swap eligibility and availability
   */
  private async validateSwapEligibility(
    request: CreateProposalFromBrowseRequest,
    userId: string
  ): Promise<{
    errors: string[];
    warnings: string[];
    userOwnsSourceSwap: boolean;
    sourceSwapAvailable: boolean;
    targetSwapAvailable: boolean;
    noExistingProposal: boolean;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let userOwnsSourceSwap = false;
    let sourceSwapAvailable = false;
    let targetSwapAvailable = false;
    let noExistingProposal = true;

    try {
      // Check source swap
      const sourceSwap = await this.swapRepository.findById(request.sourceSwapId);
      if (!sourceSwap) {
        errors.push('Source swap not found or no longer available');
      } else {
        userOwnsSourceSwap = sourceSwap.userId === userId;
        sourceSwapAvailable = sourceSwap.status === 'active';

        if (!userOwnsSourceSwap) {
          errors.push('You do not own the source swap');
        }
        if (!sourceSwapAvailable) {
          errors.push('Source swap is not available for proposals');
        }
      }

      // Check target swap
      const targetSwap = await this.swapRepository.findById(request.targetSwapId);
      if (!targetSwap) {
        errors.push('Target swap not found or no longer available');
      } else {
        targetSwapAvailable = targetSwap.status === 'active';

        if (targetSwap.userId === userId) {
          errors.push('Cannot make a proposal to your own swap');
        }
        if (!targetSwapAvailable) {
          errors.push('Target swap is not available for proposals');
        }
      }

      // Check for existing proposals
      if (sourceSwap && targetSwap) {
        const existingProposal = await this.swapRepository.findExistingProposal(
          request.sourceSwapId,
          request.targetSwapId
        );
        if (existingProposal) {
          noExistingProposal = false;
          errors.push('A proposal between these swaps already exists');
        }
      }

    } catch (error) {
      logger.error('Swap eligibility validation failed', { error, request });
      errors.push('Failed to validate swap eligibility');
    }

    return {
      errors,
      warnings,
      userOwnsSourceSwap,
      sourceSwapAvailable,
      targetSwapAvailable,
      noExistingProposal
    };
  }

  /**
   * Analyze compatibility between swaps
   */
  private async analyzeCompatibility(
    request: CreateProposalFromBrowseRequest
  ): Promise<{
    analysis?: CompatibilityAnalysis;
    warnings: string[];
    riskFactors: Array<{ type: 'low' | 'medium' | 'high'; message: string; impact: string }>;
  }> {
    const warnings: string[] = [];
    const riskFactors: Array<{ type: 'low' | 'medium' | 'high'; message: string; impact: string }> = [];

    try {
      // Get swap details with booking information
      const [sourceSwap, targetSwap] = await Promise.all([
        this.swapRepository.findByIdWithBookingDetails(request.sourceSwapId),
        this.swapRepository.findByIdWithBookingDetails(request.targetSwapId)
      ]);

      if (!sourceSwap || !targetSwap) {
        warnings.push('Unable to analyze compatibility - swap details unavailable');
        return { warnings, riskFactors };
      }

      // Calculate compatibility analysis
      const analysis = await this.calculateCompatibilityAnalysis(sourceSwap, targetSwap);

      // Generate warnings based on compatibility score
      if (analysis.overallScore < 30) {
        warnings.push(`Very low compatibility score (${analysis.overallScore}%)`);
        riskFactors.push({
          type: 'high',
          message: 'Extremely low compatibility may result in proposal rejection',
          impact: 'High likelihood of rejection'
        });
      } else if (analysis.overallScore < 50) {
        warnings.push(`Low compatibility score (${analysis.overallScore}%)`);
        riskFactors.push({
          type: 'medium',
          message: 'Low compatibility may require additional negotiation',
          impact: 'May need value adjustment or additional terms'
        });
      } else if (analysis.overallScore < 70) {
        riskFactors.push({
          type: 'low',
          message: 'Moderate compatibility - consider addressing key differences',
          impact: 'Minor adjustments may improve acceptance chances'
        });
      }

      // Check specific compatibility factors
      Object.entries(analysis.factors).forEach(([factorName, factor]) => {
        if (factor.score < 30) {
          const friendlyName = factorName.replace('Compatibility', '').toLowerCase();
          warnings.push(`Poor ${friendlyName} compatibility (${factor.score}%)`);
          riskFactors.push({
            type: 'medium',
            message: `${friendlyName} mismatch may cause issues`,
            impact: factor.details
          });
        }
      });

      return { analysis, warnings, riskFactors };

    } catch (error) {
      logger.error('Compatibility analysis failed', { error, request });
      warnings.push('Unable to perform compatibility analysis');
      return { warnings, riskFactors };
    }
  }

  /**
   * Calculate detailed compatibility analysis
   */
  private async calculateCompatibilityAnalysis(
    sourceSwap: any,
    targetSwap: any
  ): Promise<CompatibilityAnalysis> {
    // Location compatibility
    const locationScore = this.calculateLocationCompatibility(
      sourceSwap.booking?.location,
      targetSwap.booking?.location
    );

    // Date compatibility
    const dateScore = this.calculateDateCompatibility(
      sourceSwap.booking?.dateRange,
      targetSwap.booking?.dateRange
    );

    // Value compatibility
    const valueScore = this.calculateValueCompatibility(
      sourceSwap.booking?.estimatedValue || 0,
      targetSwap.booking?.estimatedValue || 0
    );

    // Accommodation compatibility
    const accommodationScore = this.calculateAccommodationCompatibility(
      sourceSwap.booking?.accommodationType,
      targetSwap.booking?.accommodationType
    );

    // Guest compatibility
    const guestScore = this.calculateGuestCompatibility(
      sourceSwap.booking?.guests || 1,
      targetSwap.booking?.guests || 1
    );

    const factors = {
      locationCompatibility: {
        score: locationScore,
        weight: 0.3,
        details: 'Location proximity and desirability analysis',
        status: this.getCompatibilityStatus(locationScore)
      },
      dateCompatibility: {
        score: dateScore,
        weight: 0.25,
        details: 'Date overlap and flexibility analysis',
        status: this.getCompatibilityStatus(dateScore)
      },
      valueCompatibility: {
        score: valueScore,
        weight: 0.2,
        details: 'Value difference and fairness analysis',
        status: this.getCompatibilityStatus(valueScore)
      },
      accommodationCompatibility: {
        score: accommodationScore,
        weight: 0.15,
        details: 'Accommodation type and amenity matching',
        status: this.getCompatibilityStatus(accommodationScore)
      },
      guestCompatibility: {
        score: guestScore,
        weight: 0.1,
        details: 'Guest capacity compatibility',
        status: this.getCompatibilityStatus(guestScore)
      }
    };

    // Calculate weighted overall score
    const overallScore = Math.round(
      Object.values(factors).reduce((sum, factor) => {
        return sum + (factor.score * factor.weight);
      }, 0)
    );

    // Generate recommendations and potential issues
    const recommendations: string[] = [];
    const potentialIssues: string[] = [];

    if (locationScore < 70) {
      recommendations.push('Consider highlighting unique aspects of your location');
    }
    if (dateScore < 70) {
      recommendations.push('Mention any date flexibility you have');
    }
    if (valueScore < 70) {
      recommendations.push('Be prepared to discuss value differences');
      potentialIssues.push('Significant value difference may require negotiation');
    }
    if (accommodationScore < 70) {
      potentialIssues.push('Different accommodation types may not meet expectations');
    }

    return {
      overallScore,
      factors,
      recommendations,
      potentialIssues
    };
  }

  /**
   * Calculate location compatibility score
   */
  private calculateLocationCompatibility(sourceLocation?: string, targetLocation?: string): number {
    if (!sourceLocation || !targetLocation) return 50;
    
    // Simple string similarity for now - in production, use geographic data
    const similarity = this.calculateStringSimilarity(sourceLocation, targetLocation);
    return Math.min(100, similarity * 100 + 30); // Base score of 30
  }

  /**
   * Calculate date compatibility score
   */
  private calculateDateCompatibility(sourceDates?: any, targetDates?: any): number {
    if (!sourceDates || !targetDates) return 50;
    
    // For now, return a moderate score - in production, analyze date overlap
    return 75;
  }

  /**
   * Calculate value compatibility score
   */
  private calculateValueCompatibility(sourceValue: number, targetValue: number): number {
    if (sourceValue === 0 || targetValue === 0) return 50;
    
    const ratio = Math.min(sourceValue, targetValue) / Math.max(sourceValue, targetValue);
    return Math.round(ratio * 100);
  }

  /**
   * Calculate accommodation compatibility score
   */
  private calculateAccommodationCompatibility(sourceType?: string, targetType?: string): number {
    if (!sourceType || !targetType) return 50;
    
    if (sourceType === targetType) return 100;
    
    // Similar accommodation types
    const similarTypes = {
      'hotel': ['resort', 'boutique hotel'],
      'apartment': ['condo', 'flat'],
      'house': ['villa', 'cottage'],
      'resort': ['hotel', 'all-inclusive']
    };
    
    const sourceSimilar = similarTypes[sourceType.toLowerCase() as keyof typeof similarTypes] || [];
    if (sourceSimilar.includes(targetType.toLowerCase())) return 80;
    
    return 40;
  }

  /**
   * Calculate guest compatibility score
   */
  private calculateGuestCompatibility(sourceGuests: number, targetGuests: number): number {
    const ratio = Math.min(sourceGuests, targetGuests) / Math.max(sourceGuests, targetGuests);
    return Math.round(ratio * 100);
  }

  /**
   * Get compatibility status from score
   */
  private getCompatibilityStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  /**
   * Calculate string similarity (simple implementation)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Validate proposal content
   */
  private validateContent(request: CreateProposalFromBrowseRequest): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Message validation
    if (request.message) {
      if (request.message.length > 500) {
        errors.push('Message exceeds maximum length of 500 characters');
      }

      // Check for inappropriate content
      if (this.containsInappropriateContent(request.message)) {
        errors.push('Message contains inappropriate content');
      }

      // Check for spam patterns
      if (this.containsSpamPatterns(request.message)) {
        warnings.push('Message may appear promotional or spam-like');
      }
    }

    // Conditions validation
    if (request.conditions.length > 10) {
      errors.push('Too many conditions specified (maximum 10)');
    }

    request.conditions.forEach((condition, index) => {
      if (condition.length > 200) {
        errors.push(`Condition ${index + 1} exceeds maximum length of 200 characters`);
      }
      if (this.containsInappropriateContent(condition)) {
        errors.push(`Condition ${index + 1} contains inappropriate content`);
      }
    });

    return { errors, warnings };
  }

  /**
   * Check for inappropriate content
   */
  private containsInappropriateContent(text: string): boolean {
    const inappropriatePatterns = [
      /\b(contact|email|phone|call|text)\s*(me|us)\b/i,
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
      /\b(whatsapp|telegram|discord|skype)\b/i, // Messaging apps
    ];

    return inappropriatePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check for spam patterns
   */
  private containsSpamPatterns(text: string): boolean {
    const spamPatterns = [
      /\b(urgent|limited time|act now|don't miss)\b/i,
      /\b(guaranteed|100%|amazing deal)\b/i,
      /(.)\1{4,}/, // Repeated characters
      /[A-Z]{5,}/, // Too many capitals
    ];

    return spamPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Validate business rules
   */
  private async validateBusinessRules(
    request: CreateProposalFromBrowseRequest,
    userId: string
  ): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check user's proposal history for patterns
      const recentProposals = await this.swapRepository.getUserRecentProposals(userId, 24); // Last 24 hours
      
      if (recentProposals.length > 10) {
        warnings.push('High proposal activity detected - ensure quality over quantity');
      }

      // Check for repeated proposals to same user
      const targetSwap = await this.swapRepository.findById(request.targetSwapId);
      if (targetSwap) {
        const proposalsToSameUser = recentProposals.filter(p => p.targetOwnerId === targetSwap.userId);
        if (proposalsToSameUser.length > 3) {
          warnings.push('Multiple recent proposals to the same user may appear excessive');
        }
      }

      // Check user account status
      const userStatus = await this.getUserAccountStatus(userId);
      if (userStatus.isRestricted) {
        errors.push('Account is restricted from creating proposals');
      }
      if (userStatus.hasWarnings) {
        warnings.push('Account has active warnings - ensure compliance with platform rules');
      }

    } catch (error) {
      logger.error('Business rules validation failed', { error, request });
      warnings.push('Unable to validate all business rules');
    }

    return { errors, warnings };
  }

  /**
   * Get user account status
   */
  private async getUserAccountStatus(userId: string): Promise<{
    isRestricted: boolean;
    hasWarnings: boolean;
  }> {
    // Mock implementation - in production, check user account status
    return {
      isRestricted: false,
      hasWarnings: false
    };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    request: CreateProposalFromBrowseRequest,
    compatibility?: CompatibilityAnalysis
  ): string[] {
    const recommendations: string[] = [];

    if (!request.message || request.message.length < 50) {
      recommendations.push('Consider adding a personal message to explain why this swap would work well');
    }

    if (request.conditions.length === 0) {
      recommendations.push('Adding specific conditions can help set clear expectations');
    }

    if (compatibility) {
      if (compatibility.overallScore < 70) {
        recommendations.push('Address compatibility concerns in your message to improve acceptance chances');
      }

      if (compatibility.factors.valueCompatibility.score < 60) {
        recommendations.push('Consider mentioning flexibility on value differences or additional compensation');
      }

      if (compatibility.factors.dateCompatibility.score < 60) {
        recommendations.push('Highlight any date flexibility you have to improve compatibility');
      }
    }

    return recommendations;
  }
}