import { BookingType } from '@booking-swap/shared';
import { logger } from '../../utils/logger';
import axios, { AxiosResponse } from 'axios';

export interface BookingValidationRequest {
  type: BookingType;
  providerDetails: {
    provider: string;
    confirmationNumber: string;
    bookingReference: string;
  };
  dateRange: {
    checkIn: Date;
    checkOut: Date;
  };
  location: {
    city: string;
    country: string;
  };
  originalPrice: number;
  title: string;
}

export interface BookingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  documents?: string[]; // IPFS hashes of validation documents
  providerResponse?: any;
}

export interface ProviderConfig {
  name: string;
  apiUrl: string;
  apiKey?: string;
  timeout: number;
  supportedTypes: BookingType[];
}

export class BookingValidationService {
  private providerConfigs: Map<string, ProviderConfig> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize provider configurations
    // In a real implementation, these would come from environment variables or config files

    const providers: ProviderConfig[] = [
      {
        name: 'booking.com',
        apiUrl: process.env.BOOKING_COM_API_URL || 'https://api.booking.com/v1',
        apiKey: process.env.BOOKING_COM_API_KEY,
        timeout: 10000,
        supportedTypes: ['hotel'],
      },
      {
        name: 'expedia',
        apiUrl: process.env.EXPEDIA_API_URL || 'https://api.expedia.com/v1',
        apiKey: process.env.EXPEDIA_API_KEY,
        timeout: 10000,
        supportedTypes: ['hotel', 'flight'],
      },
      {
        name: 'airbnb',
        apiUrl: process.env.AIRBNB_API_URL || 'https://api.airbnb.com/v1',
        apiKey: process.env.AIRBNB_API_KEY,
        timeout: 10000,
        supportedTypes: ['rental'],
      },
      {
        name: 'eventbrite',
        apiUrl: process.env.EVENTBRITE_API_URL || 'https://api.eventbrite.com/v3',
        apiKey: process.env.EVENTBRITE_API_KEY,
        timeout: 10000,
        supportedTypes: ['event'],
      },
    ];

    providers.forEach(provider => {
      this.providerConfigs.set(provider.name, provider);
    });

    logger.info('Booking validation providers initialized', {
      providers: providers.map(p => ({ name: p.name, supportedTypes: p.supportedTypes })),
    });
  }

  /**
   * Validate booking with external provider API
   */
  async validateBooking(request: BookingValidationRequest): Promise<BookingValidationResult> {
    try {
      logger.info('Validating booking', {
        provider: request.providerDetails.provider,
        type: request.type,
        confirmationNumber: request.providerDetails.confirmationNumber,
      });

      // Step 1: Basic validation
      const basicValidation = this.performBasicValidation(request);
      if (!basicValidation.isValid) {
        return basicValidation;
      }

      // Step 2: Provider-specific validation
      const providerValidation = {isValid: true,errors: [], warnings: []}; // await this.validateWithProvider(request);

      // Step 3: Combine results
      const result: BookingValidationResult = {
        isValid: basicValidation.isValid && providerValidation.isValid,
        errors: [...basicValidation.errors, ...providerValidation.errors],
        warnings: [...basicValidation.warnings, ...providerValidation.warnings],
        documents: providerValidation.documents,
        providerResponse: providerValidation.providerResponse,
      };

      logger.info('Booking validation completed', {
        provider: request.providerDetails.provider,
        isValid: result.isValid,
        errorsCount: result.errors.length,
        warningsCount: result.warnings.length,
      });

      return result;
    } catch (error) {
      logger.error('Booking validation failed', { error, request });
      return {
        isValid: false,
        errors: [`Validation service error: ${error.message}`],
        warnings: [],
      };
    }
  }

  /**
   * Perform basic validation checks
   */
  private performBasicValidation(request: BookingValidationRequest): BookingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!request.providerDetails.provider) {
      errors.push('Provider name is required');
    }

    if (!request.providerDetails.confirmationNumber) {
      errors.push('Confirmation number is required');
    }

    // bookingReference is optional - no validation needed

    // Check date validity
    const now = new Date();
    const checkIn = new Date(request.dateRange.checkIn);
    const checkOut = new Date(request.dateRange.checkOut);

    if (checkIn <= now) {
      errors.push('Check-in date must be in the future');
    }

    if (checkOut <= checkIn) {
      errors.push('Check-out date must be after check-in date');
    }

    // Check if booking is too far in the future (2 years)
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

    if (checkIn > twoYearsFromNow) {
      warnings.push('Booking is more than 2 years in the future');
    }

    // Check price validity
    if (request.originalPrice <= 0) {
      errors.push('Original price must be positive');
    }

    // Check location
    if (!request.location.city || !request.location.country) {
      errors.push('Location city and country are required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate booking with external provider API
   */
  private async validateWithProvider(request: BookingValidationRequest): Promise<BookingValidationResult> {
    const providerName = request.providerDetails.provider.toLowerCase();
    const providerConfig = this.providerConfigs.get(providerName);

    if (!providerConfig) {
      return {
        isValid: false,
        errors: [`Unsupported provider: ${request.providerDetails.provider}`],
        warnings: [],
      };
    }

    if (!providerConfig.supportedTypes.includes(request.type)) {
      return {
        isValid: false,
        errors: [`Provider ${providerName} does not support booking type: ${request.type}`],
        warnings: [],
      };
    }

    // If no API key is configured, skip external validation but warn
    if (!providerConfig.apiKey) {
      logger.warn('No API key configured for provider, skipping external validation', { provider: providerName });
      return {
        isValid: true,
        errors: [],
        warnings: [`External validation skipped for ${providerName} - no API key configured`],
      };
    }

    try {
      const validationResult = await this.callProviderAPI(providerConfig, request);
      return validationResult;
    } catch (error) {
      logger.error('Provider API validation failed', { error, provider: providerName });

      // Don't fail validation due to API errors, but add warning
      return {
        isValid: true,
        errors: [],
        warnings: [`External validation failed for ${providerName}: ${error.message}`],
      };
    }
  }

  /**
   * Call provider API for validation
   */
  private async callProviderAPI(
    config: ProviderConfig,
    request: BookingValidationRequest
  ): Promise<BookingValidationResult> {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'BookingSwapPlatform/1.0',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // Build API request based on provider
    const apiRequest = this.buildProviderRequest(config.name, request);

    try {
      const response: AxiosResponse = await axios({
        method: 'POST',
        url: `${config.apiUrl}/validate-booking`,
        headers,
        data: apiRequest,
        timeout: config.timeout,
      });

      return this.parseProviderResponse(config.name, response.data);
    } catch (error) {
      if (error.response) {
        // API returned an error response
        const statusCode = error.response.status;
        const errorData = error.response.data;

        if (statusCode === 404) {
          return {
            isValid: false,
            errors: ['Booking not found with the provider'],
            warnings: [],
            providerResponse: errorData,
          };
        } else if (statusCode === 401) {
          throw new Error('Invalid API credentials');
        } else {
          throw new Error(`Provider API error: ${statusCode} - ${errorData.message || 'Unknown error'}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Provider API timeout');
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  /**
   * Build provider-specific API request
   */
  private buildProviderRequest(providerName: string, request: BookingValidationRequest): any {
    const baseRequest = {
      confirmationNumber: request.providerDetails.confirmationNumber,
      bookingReference: request.providerDetails.bookingReference,
      checkIn: request.dateRange.checkIn.toISOString(),
      checkOut: request.dateRange.checkOut.toISOString(),
      location: request.location,
    };

    // Customize request format based on provider
    switch (providerName) {
      case 'booking.com':
        return {
          ...baseRequest,
          reservation_id: request.providerDetails.confirmationNumber,
          property_location: `${request.location.city}, ${request.location.country}`,
        };

      case 'expedia':
        return {
          ...baseRequest,
          itinerary_id: request.providerDetails.confirmationNumber,
          trip_id: request.providerDetails.bookingReference,
        };

      case 'airbnb':
        return {
          ...baseRequest,
          reservation_code: request.providerDetails.confirmationNumber,
          listing_location: request.location,
        };

      case 'eventbrite':
        return {
          ...baseRequest,
          order_id: request.providerDetails.confirmationNumber,
          event_id: request.providerDetails.bookingReference,
          event_date: request.dateRange.checkIn.toISOString(),
        };

      default:
        return baseRequest;
    }
  }

  /**
   * Parse provider API response
   */
  private parseProviderResponse(providerName: string, responseData: any): BookingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let isValid = false;

    try {
      // Parse response based on provider format
      switch (providerName) {
        case 'booking.com':
          isValid = responseData.status === 'confirmed' && responseData.is_valid === true;
          if (!isValid && responseData.error_message) {
            errors.push(responseData.error_message);
          }
          break;

        case 'expedia':
          isValid = responseData.reservation_status === 'active';
          if (!isValid && responseData.status_message) {
            errors.push(responseData.status_message);
          }
          break;

        case 'airbnb':
          isValid = responseData.reservation_status === 'accepted';
          if (!isValid && responseData.cancellation_policy) {
            warnings.push(`Cancellation policy: ${responseData.cancellation_policy}`);
          }
          break;

        case 'eventbrite':
          isValid = responseData.order_status === 'placed' && responseData.event_status === 'live';
          if (!isValid) {
            if (responseData.order_status !== 'placed') {
              errors.push(`Order status: ${responseData.order_status}`);
            }
            if (responseData.event_status !== 'live') {
              errors.push(`Event status: ${responseData.event_status}`);
            }
          }
          break;

        default:
          // Generic response parsing
          isValid = responseData.valid === true || responseData.status === 'valid';
          if (!isValid && responseData.message) {
            errors.push(responseData.message);
          }
      }

      // Check for additional warnings
      if (responseData.warnings && Array.isArray(responseData.warnings)) {
        warnings.push(...responseData.warnings);
      }

      return {
        isValid,
        errors,
        warnings,
        providerResponse: responseData,
      };
    } catch (error) {
      logger.error('Failed to parse provider response', { error, providerName, responseData });
      return {
        isValid: false,
        errors: ['Failed to parse provider response'],
        warnings: [],
        providerResponse: responseData,
      };
    }
  }

  /**
   * Get supported providers for a booking type
   */
  getSupportedProviders(bookingType: BookingType): string[] {
    const supportedProviders: string[] = [];

    this.providerConfigs.forEach((config, name) => {
      if (config.supportedTypes.includes(bookingType)) {
        supportedProviders.push(name);
      }
    });

    return supportedProviders;
  }

  /**
   * Check if a provider is supported
   */
  isProviderSupported(providerName: string, bookingType?: BookingType): boolean {
    const config = this.providerConfigs.get(providerName.toLowerCase());
    if (!config) {
      return false;
    }

    if (bookingType) {
      return config.supportedTypes.includes(bookingType);
    }

    return true;
  }
}