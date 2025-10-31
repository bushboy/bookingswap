import {
  CompatibilityAnalysis,
  CompatibilityFactor,
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';

export interface SwapBookingDetails {
  location: string;
  dateRange: {
    checkIn: Date;
    checkOut: Date;
  };
  totalPrice: number;
  accommodationType: string;
  guests: number;
}

export interface LocationAnalysisConfig {
  exactMatchScore: number;
  sameRegionScore: number;
  sameCountryScore: number;
  sameContinentScore: number;
  differentContinentScore: number;
}

export interface DateAnalysisConfig {
  overlapPenalty: number;
  sameDurationScore: number;
  similarDurationThreshold: number; // days
  moderateDurationThreshold: number; // days
}

export interface ValueAnalysisConfig {
  excellentThreshold: number; // percentage
  goodThreshold: number; // percentage
  fairThreshold: number; // percentage
  poorThreshold: number; // percentage
}

export interface CompatibilityWeights {
  location: number;
  date: number;
  value: number;
  accommodation: number;
  guest: number;
}

export class CompatibilityAnalysisEngine {
  private readonly defaultWeights: CompatibilityWeights = {
    location: 0.25,
    date: 0.20,
    value: 0.30,
    accommodation: 0.15,
    guest: 0.10,
  };

  private readonly locationConfig: LocationAnalysisConfig = {
    exactMatchScore: 100,
    sameRegionScore: 80,
    sameCountryScore: 60,
    sameContinentScore: 40,
    differentContinentScore: 20,
  };

  private readonly dateConfig: DateAnalysisConfig = {
    overlapPenalty: 10,
    sameDurationScore: 100,
    similarDurationThreshold: 3,
    moderateDurationThreshold: 7,
  };

  private readonly valueConfig: ValueAnalysisConfig = {
    excellentThreshold: 5,
    goodThreshold: 15,
    fairThreshold: 30,
    poorThreshold: 50,
  };

  constructor(
    private customWeights?: Partial<CompatibilityWeights>
  ) {}

  /**
   * Analyze compatibility between two swap bookings
   * Requirements: 2.6, 2.7
   */
  async analyzeCompatibility(
    sourceBooking: SwapBookingDetails,
    targetBooking: SwapBookingDetails
  ): Promise<CompatibilityAnalysis> {
    try {
      logger.info('Starting compatibility analysis', {
        sourceLocation: sourceBooking.location,
        targetLocation: targetBooking.location,
        sourceValue: sourceBooking.totalPrice,
        targetValue: targetBooking.totalPrice
      });

      const weights = { ...this.defaultWeights, ...this.customWeights };

      // Calculate individual compatibility factors
      const factors = {
        locationCompatibility: this.analyzeLocationCompatibility(sourceBooking, targetBooking),
        dateCompatibility: this.analyzeDateCompatibility(sourceBooking, targetBooking),
        valueCompatibility: this.analyzeValueCompatibility(sourceBooking, targetBooking),
        accommodationCompatibility: this.analyzeAccommodationCompatibility(sourceBooking, targetBooking),
        guestCompatibility: this.analyzeGuestCompatibility(sourceBooking, targetBooking),
      };

      // Apply custom weights
      factors.locationCompatibility.weight = weights.location;
      factors.dateCompatibility.weight = weights.date;
      factors.valueCompatibility.weight = weights.value;
      factors.accommodationCompatibility.weight = weights.accommodation;
      factors.guestCompatibility.weight = weights.guest;

      // Calculate overall score
      const overallScore = this.calculateOverallScore(factors);

      // Generate insights
      const recommendations = this.generateRecommendations(factors);
      const potentialIssues = this.identifyPotentialIssues(factors);

      const analysis: CompatibilityAnalysis = {
        overallScore,
        factors,
        recommendations,
        potentialIssues,
      };

      logger.info('Compatibility analysis completed', {
        overallScore,
        locationScore: factors.locationCompatibility.score,
        dateScore: factors.dateCompatibility.score,
        valueScore: factors.valueCompatibility.score,
        accommodationScore: factors.accommodationCompatibility.score,
        guestScore: factors.guestCompatibility.score
      });

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze compatibility', { error });
      throw error;
    }
  }

  /**
   * Analyze location compatibility with distance and region matching
   * Requirements: 2.6, 2.7
   */
  private analyzeLocationCompatibility(
    sourceBooking: SwapBookingDetails,
    targetBooking: SwapBookingDetails
  ): CompatibilityFactor {
    try {
      const sourceLocation = this.normalizeLocation(sourceBooking.location);
      const targetLocation = this.normalizeLocation(targetBooking.location);

      let score = 0;
      let details = '';
      let status: CompatibilityFactor['status'] = 'poor';

      if (this.isExactLocationMatch(sourceLocation, targetLocation)) {
        score = this.locationConfig.exactMatchScore;
        details = 'Exact location match - ideal for local swaps';
        status = 'excellent';
      } else if (this.isSameRegion(sourceLocation, targetLocation)) {
        score = this.locationConfig.sameRegionScore;
        details = 'Same region/metropolitan area - minimal travel required';
        status = 'good';
      } else if (this.isSameCountry(sourceLocation, targetLocation)) {
        score = this.locationConfig.sameCountryScore;
        details = 'Same country, different regions - domestic travel';
        status = 'fair';
      } else if (this.isSameContinent(sourceLocation, targetLocation)) {
        score = this.locationConfig.sameContinentScore;
        details = 'Same continent - international travel within region';
        status = 'fair';
      } else {
        score = this.locationConfig.differentContinentScore;
        details = 'Different continents - long-distance international travel';
        status = 'poor';
      }

      // Apply distance-based adjustments if available
      const estimatedDistance = this.estimateDistance(sourceLocation, targetLocation);
      if (estimatedDistance) {
        const distanceAdjustment = this.calculateDistanceAdjustment(estimatedDistance);
        score = Math.max(0, Math.min(100, score + distanceAdjustment));
        details += ` (Est. ${estimatedDistance}km)`;
      }

      return {
        score: Math.round(score),
        weight: this.defaultWeights.location,
        details,
        status,
      };
    } catch (error) {
      logger.warn('Failed to analyze location compatibility', { error });
      return this.createDefaultFactor('location', 'Unable to analyze location compatibility');
    }
  }

  /**
   * Analyze date compatibility with overlap and flexibility scoring
   * Requirements: 2.6, 2.7
   */
  private analyzeDateCompatibility(
    sourceBooking: SwapBookingDetails,
    targetBooking: SwapBookingDetails
  ): CompatibilityFactor {
    try {
      const sourceCheckIn = new Date(sourceBooking.dateRange.checkIn);
      const sourceCheckOut = new Date(sourceBooking.dateRange.checkOut);
      const targetCheckIn = new Date(targetBooking.dateRange.checkIn);
      const targetCheckOut = new Date(targetBooking.dateRange.checkOut);

      // Calculate durations in days
      const sourceDuration = this.calculateDaysBetween(sourceCheckIn, sourceCheckOut);
      const targetDuration = this.calculateDaysBetween(targetCheckIn, targetCheckOut);
      const durationDiff = Math.abs(sourceDuration - targetDuration);

      // Check for date overlap
      const hasOverlap = this.hasDateOverlap(
        sourceCheckIn, sourceCheckOut,
        targetCheckIn, targetCheckOut
      );

      let score = 0;
      let details = '';
      let status: CompatibilityFactor['status'] = 'poor';

      if (hasOverlap) {
        score = this.dateConfig.overlapPenalty;
        details = 'Date ranges overlap - requires careful coordination';
        status = 'poor';
      } else if (durationDiff === 0) {
        score = this.dateConfig.sameDurationScore;
        details = `Perfect duration match (${sourceDuration} days)`;
        status = 'excellent';
      } else if (durationDiff <= 1) {
        score = 95;
        details = `Nearly identical durations (${sourceDuration} vs ${targetDuration} days)`;
        status = 'excellent';
      } else if (durationDiff <= this.dateConfig.similarDurationThreshold) {
        score = 80;
        details = `Similar durations (${sourceDuration} vs ${targetDuration} days)`;
        status = 'good';
      } else if (durationDiff <= this.dateConfig.moderateDurationThreshold) {
        score = 60;
        details = `Moderately different durations (${sourceDuration} vs ${targetDuration} days)`;
        status = 'fair';
      } else {
        score = 30;
        details = `Very different durations (${sourceDuration} vs ${targetDuration} days)`;
        status = 'poor';
      }

      // Apply seasonal compatibility bonus
      const seasonalBonus = this.calculateSeasonalCompatibility(sourceCheckIn, targetCheckIn);
      score = Math.min(100, score + seasonalBonus);

      if (seasonalBonus > 0) {
        details += ` +${seasonalBonus} seasonal match bonus`;
      }

      return {
        score: Math.round(score),
        weight: this.defaultWeights.date,
        details,
        status,
      };
    } catch (error) {
      logger.warn('Failed to analyze date compatibility', { error });
      return this.createDefaultFactor('date', 'Unable to analyze date compatibility');
    }
  }

  /**
   * Analyze value compatibility with price range comparison
   * Requirements: 2.6, 2.7
   */
  private analyzeValueCompatibility(
    sourceBooking: SwapBookingDetails,
    targetBooking: SwapBookingDetails
  ): CompatibilityFactor {
    try {
      const sourceValue = sourceBooking.totalPrice || 0;
      const targetValue = targetBooking.totalPrice || 0;

      if (sourceValue === 0 || targetValue === 0) {
        return {
          score: 50,
          weight: this.defaultWeights.value,
          details: 'Unable to compare values - missing price information',
          status: 'fair',
        };
      }

      const valueDiff = Math.abs(sourceValue - targetValue);
      const avgValue = (sourceValue + targetValue) / 2;
      const percentageDiff = (valueDiff / avgValue) * 100;

      let score = 0;
      let details = '';
      let status: CompatibilityFactor['status'] = 'poor';

      if (percentageDiff <= this.valueConfig.excellentThreshold) {
        score = 100;
        details = `Excellent value match (${percentageDiff.toFixed(1)}% difference)`;
        status = 'excellent';
      } else if (percentageDiff <= this.valueConfig.goodThreshold) {
        score = 85;
        details = `Good value match (${percentageDiff.toFixed(1)}% difference)`;
        status = 'good';
      } else if (percentageDiff <= this.valueConfig.fairThreshold) {
        score = 70;
        details = `Fair value match (${percentageDiff.toFixed(1)}% difference)`;
        status = 'fair';
      } else if (percentageDiff <= this.valueConfig.poorThreshold) {
        score = 50;
        details = `Significant value difference (${percentageDiff.toFixed(1)}% difference)`;
        status = 'fair';
      } else {
        score = 25;
        details = `Large value difference (${percentageDiff.toFixed(1)}% difference) - may require additional payment`;
        status = 'poor';
      }

      // Add value range information
      const lowerValue = Math.min(sourceValue, targetValue);
      const higherValue = Math.max(sourceValue, targetValue);
      details += ` ($${lowerValue.toLocaleString()} vs $${higherValue.toLocaleString()})`;

      return {
        score: Math.round(score),
        weight: this.defaultWeights.value,
        details,
        status,
      };
    } catch (error) {
      logger.warn('Failed to analyze value compatibility', { error });
      return this.createDefaultFactor('value', 'Unable to analyze value compatibility');
    }
  }

  /**
   * Analyze accommodation type compatibility scoring
   * Requirements: 2.6, 2.7
   */
  private analyzeAccommodationCompatibility(
    sourceBooking: SwapBookingDetails,
    targetBooking: SwapBookingDetails
  ): CompatibilityFactor {
    try {
      const sourceType = this.normalizeAccommodationType(sourceBooking.accommodationType);
      const targetType = this.normalizeAccommodationType(targetBooking.accommodationType);

      let score = 0;
      let details = '';
      let status: CompatibilityFactor['status'] = 'poor';

      if (sourceType === targetType) {
        score = 100;
        details = `Perfect match: ${sourceType}`;
        status = 'excellent';
      } else if (this.isSimilarAccommodationType(sourceType, targetType)) {
        score = 75;
        details = `Similar types: ${sourceType} ↔ ${targetType}`;
        status = 'good';
      } else if (this.isCompatibleAccommodationType(sourceType, targetType)) {
        score = 50;
        details = `Compatible types: ${sourceType} ↔ ${targetType}`;
        status = 'fair';
      } else {
        score = 25;
        details = `Different types: ${sourceType} ↔ ${targetType}`;
        status = 'poor';
      }

      // Apply luxury level adjustment
      const luxuryAdjustment = this.calculateLuxuryLevelCompatibility(sourceType, targetType);
      score = Math.max(0, Math.min(100, score + luxuryAdjustment));

      if (luxuryAdjustment !== 0) {
        details += ` (${luxuryAdjustment > 0 ? '+' : ''}${luxuryAdjustment} luxury adjustment)`;
      }

      return {
        score: Math.round(score),
        weight: this.defaultWeights.accommodation,
        details,
        status,
      };
    } catch (error) {
      logger.warn('Failed to analyze accommodation compatibility', { error });
      return this.createDefaultFactor('accommodation', 'Unable to analyze accommodation compatibility');
    }
  }

  /**
   * Analyze guest count compatibility
   * Requirements: 2.6, 2.7
   */
  private analyzeGuestCompatibility(
    sourceBooking: SwapBookingDetails,
    targetBooking: SwapBookingDetails
  ): CompatibilityFactor {
    try {
      const sourceGuests = sourceBooking.guests || 1;
      const targetGuests = targetBooking.guests || 1;

      const guestDiff = Math.abs(sourceGuests - targetGuests);
      const maxGuests = Math.max(sourceGuests, targetGuests);
      const minGuests = Math.min(sourceGuests, targetGuests);

      let score = 0;
      let details = '';
      let status: CompatibilityFactor['status'] = 'poor';

      if (guestDiff === 0) {
        score = 100;
        details = `Perfect match: ${sourceGuests} guests`;
        status = 'excellent';
      } else if (guestDiff === 1) {
        score = 85;
        details = `Very close: ${sourceGuests} vs ${targetGuests} guests`;
        status = 'good';
      } else if (guestDiff <= 2) {
        score = 70;
        details = `Similar: ${sourceGuests} vs ${targetGuests} guests`;
        status = 'fair';
      } else if (guestDiff <= Math.max(2, maxGuests * 0.25)) {
        score = 50;
        details = `Moderate difference: ${sourceGuests} vs ${targetGuests} guests`;
        status = 'fair';
      } else {
        score = 25;
        details = `Large difference: ${sourceGuests} vs ${targetGuests} guests`;
        status = 'poor';
      }

      // Apply capacity utilization bonus/penalty
      const utilizationFactor = minGuests / maxGuests;
      if (utilizationFactor >= 0.8) {
        score = Math.min(100, score + 5);
        details += ' (good capacity match)';
      } else if (utilizationFactor < 0.5) {
        score = Math.max(0, score - 10);
        details += ' (capacity mismatch)';
      }

      return {
        score: Math.round(score),
        weight: this.defaultWeights.guest,
        details,
        status,
      };
    } catch (error) {
      logger.warn('Failed to analyze guest compatibility', { error });
      return this.createDefaultFactor('guest', 'Unable to analyze guest compatibility');
    }
  }

  // Private helper methods

  /**
   * Calculate overall compatibility score using weighted factors
   */
  private calculateOverallScore(factors: CompatibilityAnalysis['factors']): number {
    try {
      const weightedSum = Object.values(factors).reduce((sum, factor) => {
        return sum + (factor.score * factor.weight);
      }, 0);

      const totalWeight = Object.values(factors).reduce((sum, factor) => sum + factor.weight, 0);

      if (totalWeight === 0) {
        return 50; // Default score if no weights
      }

      return Math.round(weightedSum / totalWeight);
    } catch (error) {
      logger.warn('Failed to calculate overall compatibility score', { error });
      return 50;
    }
  }

  /**
   * Generate compatibility recommendations based on factors
   */
  private generateRecommendations(factors: CompatibilityAnalysis['factors']): string[] {
    const recommendations: string[] = [];

    // Location recommendations
    if (factors.locationCompatibility.score >= 80) {
      recommendations.push('Excellent location match - minimal travel coordination needed');
    } else if (factors.locationCompatibility.score < 60) {
      recommendations.push('Consider travel costs and logistics for both parties');
    }

    // Date recommendations
    if (factors.dateCompatibility.score >= 80) {
      recommendations.push('Great date compatibility - similar stay durations');
    } else if (factors.dateCompatibility.score < 60) {
      recommendations.push('Review date flexibility and coordination requirements');
    }

    // Value recommendations
    if (factors.valueCompatibility.score >= 80) {
      recommendations.push('Well-matched booking values - fair exchange');
    } else if (factors.valueCompatibility.score < 60) {
      recommendations.push('Discuss potential additional payments or value adjustments');
    }

    // Accommodation recommendations
    if (factors.accommodationCompatibility.score >= 80) {
      recommendations.push('Compatible accommodation types - good match');
    } else if (factors.accommodationCompatibility.score < 60) {
      recommendations.push('Ensure both parties are comfortable with accommodation differences');
    }

    // Guest recommendations
    if (factors.guestCompatibility.score >= 80) {
      recommendations.push('Guest count compatibility - suitable for both parties');
    } else if (factors.guestCompatibility.score < 60) {
      recommendations.push('Verify accommodation capacity for different guest counts');
    }

    // Overall recommendations
    const overallScore = this.calculateOverallScore(factors);
    if (overallScore >= 80) {
      recommendations.push('This appears to be an excellent swap match - highly recommended');
    } else if (overallScore >= 65) {
      recommendations.push('This is a good swap opportunity with strong compatibility');
    } else if (overallScore >= 40) {
      recommendations.push('Moderate compatibility - discuss details before proceeding');
    }

    return recommendations;
  }

  /**
   * Identify potential issues based on compatibility factors
   */
  private identifyPotentialIssues(factors: CompatibilityAnalysis['factors']): string[] {
    const issues: string[] = [];

    if (factors.locationCompatibility.score < 40) {
      issues.push('Significant location difference may affect travel costs and logistics');
    }

    if (factors.dateCompatibility.score < 40) {
      issues.push('Date incompatibility may require complex coordination or flexibility');
    }

    if (factors.valueCompatibility.score < 40) {
      issues.push('Large value difference may require substantial additional payment');
    }

    if (factors.accommodationCompatibility.score < 40) {
      issues.push('Accommodation type mismatch may not meet expectations');
    }

    if (factors.guestCompatibility.score < 40) {
      issues.push('Guest count difference may affect accommodation suitability');
    }

    // Check for multiple low scores
    const lowScoreCount = Object.values(factors).filter(factor => factor.score < 50).length;
    if (lowScoreCount >= 3) {
      issues.push('Multiple compatibility concerns - careful consideration recommended');
    }

    return issues;
  }

  /**
   * Normalize location string for comparison
   */
  private normalizeLocation(location: string): string {
    return location.toLowerCase().trim().replace(/[^\w\s]/g, '');
  }

  /**
   * Check if two locations are exactly the same
   */
  private isExactLocationMatch(location1: string, location2: string): boolean {
    return location1 === location2;
  }

  /**
   * Check if two locations are in the same region
   */
  private isSameRegion(location1: string, location2: string): boolean {
    const regionMappings = [
      // US Regions
      ['new york', 'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island', 'nyc'],
      ['los angeles', 'hollywood', 'beverly hills', 'santa monica', 'west hollywood', 'la'],
      ['san francisco', 'oakland', 'berkeley', 'san jose', 'bay area'],
      ['chicago', 'evanston', 'naperville', 'schaumburg'],
      ['miami', 'south beach', 'coral gables', 'key biscayne'],
      
      // European Regions
      ['london', 'westminster', 'kensington', 'chelsea', 'camden', 'greenwich'],
      ['paris', 'montmartre', 'marais', 'saint germain', 'champs elysees'],
      ['rome', 'vatican', 'trastevere', 'centro storico'],
      ['barcelona', 'gothic quarter', 'eixample', 'gracia'],
      
      // Asian Regions
      ['tokyo', 'shibuya', 'shinjuku', 'harajuku', 'ginza', 'roppongi'],
      ['singapore', 'orchard', 'marina bay', 'sentosa'],
      ['hong kong', 'central', 'tsim sha tsui', 'causeway bay'],
    ];

    return regionMappings.some(region => 
      region.some(place => location1.includes(place)) && 
      region.some(place => location2.includes(place))
    );
  }

  /**
   * Check if two locations are in the same country
   */
  private isSameCountry(location1: string, location2: string): boolean {
    const countryMappings = [
      ['usa', 'united states', 'america', 'us', 'new york', 'los angeles', 'chicago', 'miami'],
      ['uk', 'united kingdom', 'england', 'britain', 'london', 'manchester', 'birmingham'],
      ['france', 'french', 'paris', 'lyon', 'marseille', 'nice'],
      ['germany', 'german', 'berlin', 'munich', 'hamburg', 'cologne'],
      ['italy', 'italian', 'rome', 'milan', 'florence', 'venice'],
      ['spain', 'spanish', 'madrid', 'barcelona', 'seville', 'valencia'],
      ['japan', 'japanese', 'tokyo', 'osaka', 'kyoto', 'hiroshima'],
      ['australia', 'australian', 'sydney', 'melbourne', 'brisbane', 'perth'],
    ];

    return countryMappings.some(country => 
      country.some(keyword => location1.includes(keyword)) && 
      country.some(keyword => location2.includes(keyword))
    );
  }

  /**
   * Check if two locations are on the same continent
   */
  private isSameContinent(location1: string, location2: string): boolean {
    const continentMappings = [
      ['europe', 'european', 'uk', 'france', 'germany', 'italy', 'spain', 'london', 'paris'],
      ['north america', 'america', 'usa', 'canada', 'mexico', 'united states', 'new york'],
      ['asia', 'asian', 'japan', 'china', 'korea', 'thailand', 'singapore', 'tokyo'],
      ['oceania', 'australia', 'new zealand', 'sydney', 'melbourne'],
      ['south america', 'brazil', 'argentina', 'chile', 'colombia'],
      ['africa', 'south africa', 'egypt', 'morocco', 'kenya'],
    ];

    return continentMappings.some(continent => 
      continent.some(keyword => location1.includes(keyword)) && 
      continent.some(keyword => location2.includes(keyword))
    );
  }

  /**
   * Estimate distance between two locations (simplified implementation)
   */
  private estimateDistance(location1: string, location2: string): number | null {
    // This is a simplified implementation
    // In production, this would use a proper geocoding and distance calculation service
    
    const majorCityCoordinates: { [key: string]: { lat: number; lng: number } } = {
      'new york': { lat: 40.7128, lng: -74.0060 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'london': { lat: 51.5074, lng: -0.1278 },
      'paris': { lat: 48.8566, lng: 2.3522 },
      'tokyo': { lat: 35.6762, lng: 139.6503 },
      'sydney': { lat: -33.8688, lng: 151.2093 },
    };

    const coord1 = majorCityCoordinates[location1];
    const coord2 = majorCityCoordinates[location2];

    if (!coord1 || !coord2) {
      return null;
    }

    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.lat - coord1.lat);
    const dLng = this.toRadians(coord2.lng - coord1.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(coord1.lat)) * Math.cos(this.toRadians(coord2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance);
  }

  /**
   * Calculate distance-based score adjustment
   */
  private calculateDistanceAdjustment(distance: number): number {
    if (distance < 50) return 5;      // Very close
    if (distance < 200) return 0;     // Reasonable distance
    if (distance < 500) return -5;    // Moderate distance
    if (distance < 1000) return -10;  // Long distance
    return -15;                       // Very long distance
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate days between two dates
   */
  private calculateDaysBetween(startDate: Date, endDate: Date): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  /**
   * Check if date ranges overlap
   */
  private hasDateOverlap(
    start1: Date, end1: Date,
    start2: Date, end2: Date
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Calculate seasonal compatibility bonus
   */
  private calculateSeasonalCompatibility(date1: Date, date2: Date): number {
    const month1 = date1.getMonth();
    const month2 = date2.getMonth();

    // Define seasons (Northern Hemisphere)
    const getSeason = (month: number): string => {
      if (month >= 2 && month <= 4) return 'spring';
      if (month >= 5 && month <= 7) return 'summer';
      if (month >= 8 && month <= 10) return 'fall';
      return 'winter';
    };

    const season1 = getSeason(month1);
    const season2 = getSeason(month2);

    if (season1 === season2) {
      return 5; // Same season bonus
    }

    // Adjacent seasons get smaller bonus
    const adjacentSeasons = [
      ['spring', 'summer'],
      ['summer', 'fall'],
      ['fall', 'winter'],
      ['winter', 'spring']
    ];

    const isAdjacent = adjacentSeasons.some(pair => 
      (pair[0] === season1 && pair[1] === season2) ||
      (pair[1] === season1 && pair[0] === season2)
    );

    return isAdjacent ? 2 : 0;
  }

  /**
   * Normalize accommodation type for comparison
   */
  private normalizeAccommodationType(type: string): string {
    const normalized = type.toLowerCase().trim();
    
    // Map variations to standard types
    const typeMapping: { [key: string]: string } = {
      'hotel': 'hotel',
      'motel': 'hotel',
      'inn': 'hotel',
      'resort': 'resort',
      'apartment': 'apartment',
      'flat': 'apartment',
      'condo': 'apartment',
      'condominium': 'apartment',
      'house': 'house',
      'home': 'house',
      'villa': 'villa',
      'cottage': 'cottage',
      'cabin': 'cottage',
      'hostel': 'hostel',
      'guesthouse': 'guesthouse',
      'b&b': 'guesthouse',
      'bed and breakfast': 'guesthouse',
    };

    for (const [key, value] of Object.entries(typeMapping)) {
      if (normalized.includes(key)) {
        return value;
      }
    }

    return normalized;
  }

  /**
   * Check if accommodation types are similar
   */
  private isSimilarAccommodationType(type1: string, type2: string): boolean {
    const similarGroups = [
      ['hotel', 'resort', 'inn'],
      ['apartment', 'condo', 'flat'],
      ['house', 'villa', 'cottage'],
      ['hostel', 'guesthouse'],
    ];

    return similarGroups.some(group => 
      group.includes(type1) && group.includes(type2)
    );
  }

  /**
   * Check if accommodation types are compatible
   */
  private isCompatibleAccommodationType(type1: string, type2: string): boolean {
    const compatiblePairs = [
      ['hotel', 'apartment'],
      ['resort', 'villa'],
      ['apartment', 'house'],
      ['inn', 'guesthouse'],
      ['villa', 'cottage'],
      ['hotel', 'guesthouse'],
    ];

    return compatiblePairs.some(pair => 
      (pair[0] === type1 && pair[1] === type2) || 
      (pair[1] === type1 && pair[0] === type2)
    );
  }

  /**
   * Calculate luxury level compatibility adjustment
   */
  private calculateLuxuryLevelCompatibility(type1: string, type2: string): number {
    const luxuryLevels: { [key: string]: number } = {
      'resort': 5,
      'villa': 4,
      'hotel': 3,
      'apartment': 2,
      'house': 2,
      'cottage': 2,
      'guesthouse': 1,
      'hostel': 1,
    };

    const level1 = luxuryLevels[type1] || 2;
    const level2 = luxuryLevels[type2] || 2;
    const levelDiff = Math.abs(level1 - level2);

    if (levelDiff === 0) return 5;   // Same luxury level
    if (levelDiff === 1) return 0;   // Adjacent luxury level
    if (levelDiff === 2) return -5;  // Moderate difference
    return -10;                      // Large luxury difference
  }

  /**
   * Create a default compatibility factor for error cases
   */
  private createDefaultFactor(type: string, details: string): CompatibilityFactor {
    return {
      score: 50,
      weight: this.defaultWeights[type as keyof CompatibilityWeights] || 0.2,
      details,
      status: 'fair',
    };
  }

  /**
   * Update compatibility weights for custom analysis
   */
  public updateWeights(newWeights: Partial<CompatibilityWeights>): void {
    Object.assign(this.defaultWeights, newWeights);
    
    // Ensure weights sum to 1.0
    const totalWeight = Object.values(this.defaultWeights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      logger.warn('Compatibility weights do not sum to 1.0', { 
        weights: this.defaultWeights, 
        totalWeight 
      });
    }
  }

  /**
   * Get current compatibility weights
   */
  public getWeights(): CompatibilityWeights {
    return { ...this.defaultWeights };
  }
}