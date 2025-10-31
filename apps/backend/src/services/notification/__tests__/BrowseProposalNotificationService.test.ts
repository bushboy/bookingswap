import { BrowseProposalNotificationService } from '../BrowseProposalNotificationService';
import { NotificationService } from '../NotificationService';
import { NotificationPreferencesService } from '../NotificationPreferencesService';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import { UserRepository } from '../../../database/repositories/UserRepository';
import { BookingService } from '../../booking/BookingService';
import { SwapMatchingService } from '../../swap/SwapMatchingService';

// Mock dependencies
jest.mock('../NotificationService');
jest.mock('../NotificationPreferencesService');
jest.mock('../../../database/repositories/SwapRepository');
jest.mock('../../../database/repositories/UserRepository');
jest.mock('../../booking/BookingService');
jest.mock('../../swap/SwapMatchingService');

describe('BrowseProposalNotificationService', () => {
  let service: BrowseProposalNotificationService;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockSwapRepository: jest.Mocked<SwapRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockBookingService: jest.Mocked<BookingService>;
  let mockSwapMatchingService: jest.Mocked<SwapMatchingService>;

  beforeEach(() => {
    mockNotificationService = new NotificationService({} as any, {} as any) as jest.Mocked<NotificationService>;
    mockSwapRepository = new SwapRepository({} as any) as jest.Mocked<SwapRepository>;
    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;
    mockBookingService = new BookingService({} as any, {} as any) as jest.Mocked<BookingService>;
    mockSwapMatchingService = new SwapMatchingService({} as any, {} as any, {} as any) as jest.Mocked<SwapMatchingService>;

    service = new BrowseProposalNotificationService(
      mockNotificationService,
      mockSwapRepository,
      mockBookingService,
      mockUserRepository,
      mockSwapMatchingService
    );
  });

  describe('sendBrowseProposalReceivedNotification', () => {
    it('should send notification with enhanced content', async () => {
      // Mock data
      const proposalData = {
        proposalId: 'proposal-123',
        sourceSwapId: 'swap-456',
        targetSwapId: 'swap-789',
        proposerId: 'user-123',
        targetOwnerId: 'user-456',
        message: 'Great match!'
      };

      // Mock swap and booking data
      const mockSourceSwap = {
        id: 'swap-456',
        sourceBookingId: 'booking-456',
        ownerId: 'user-123'
      };

      const mockTargetSwap = {
        id: 'swap-789',
        sourceBookingId: 'booking-789',
        ownerId: 'user-456'
      };

      const mockSourceBooking = {
        id: 'booking-456',
        title: 'Paris Hotel',
        location: { city: 'Paris', country: 'France' },
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-07')
        },
        totalPrice: 1200,
        accommodationType: 'Hotel',
        guests: 2
      };

      const mockTargetBooking = {
        id: 'booking-789',
        title: 'London Apartment',
        location: { city: 'London', country: 'UK' },
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-07')
        },
        totalPrice: 1000,
        accommodationType: 'Apartment',
        guests: 2
      };

      const mockCompatibilityAnalysis = {
        overallScore: 85,
        factors: {
          locationCompatibility: { score: 80 },
          dateCompatibility: { score: 95 },
          valueCompatibility: { score: 85 },
          accommodationCompatibility: { score: 75 },
          guestCompatibility: { score: 100 }
        }
      };

      // Setup mocks
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);

      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking as any)
        .mockResolvedValueOnce(mockTargetBooking as any);

      mockSwapMatchingService.analyzeSwapCompatibility
        .mockResolvedValue(mockCompatibilityAnalysis as any);

      // Mock preferences service methods
      const mockPreferencesService = service['preferencesService'] as jest.Mocked<NotificationPreferencesService>;
      mockPreferencesService.shouldSendNotification = jest.fn().mockResolvedValue(true);
      mockPreferencesService.generateEnhancedNotificationContent = jest.fn().mockResolvedValue({
        subject: 'Enhanced Subject',
        content: 'Enhanced Content',
        metadata: {
          priority: 'high',
          category: 'browse_proposal',
          compatibilityScore: 85,
          includesComparison: true
        },
        richContent: {
          compatibilityChart: '<div>Chart</div>',
          swapComparison: '<table>Comparison</table>',
          actionButtons: [{ text: 'Review', url: '/review', style: 'primary' }]
        }
      });

      mockNotificationService.sendNotification = jest.fn().mockResolvedValue(undefined);

      // Execute
      await service.sendBrowseProposalReceivedNotification(proposalData);

      // Verify
      expect(mockPreferencesService.shouldSendNotification).toHaveBeenCalledWith(
        'user-456',
        'browse_proposal_received',
        85
      );

      expect(mockPreferencesService.generateEnhancedNotificationContent).toHaveBeenCalledWith(
        'user-456',
        'browse_proposal_received',
        expect.objectContaining({
          subject: expect.stringContaining('Paris Hotel')
        }),
        expect.objectContaining({
          compatibilityAnalysis: mockCompatibilityAnalysis,
          swapComparison: expect.objectContaining({
            source: expect.objectContaining({ title: 'Paris Hotel' }),
            target: expect.objectContaining({ title: 'London Apartment' })
          })
        })
      );

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        'browse_proposal_received',
        'user-456',
        expect.objectContaining({
          proposalId: 'proposal-123',
          compatibilityScore: 85,
          priority: 'high'
        })
      );
    });

    it('should skip notification if user preferences indicate low compatibility threshold', async () => {
      const proposalData = {
        proposalId: 'proposal-123',
        sourceSwapId: 'swap-456',
        targetSwapId: 'swap-789',
        proposerId: 'user-123',
        targetOwnerId: 'user-456'
      };

      // Mock low compatibility
      const mockCompatibilityAnalysis = {
        overallScore: 25,
        factors: {
          locationCompatibility: { score: 20 },
          dateCompatibility: { score: 30 },
          valueCompatibility: { score: 25 },
          accommodationCompatibility: { score: 20 },
          guestCompatibility: { score: 30 }
        }
      };

      // Setup basic mocks
      mockSwapRepository.findById.mockResolvedValue({ sourceBookingId: 'booking-123' } as any);
      mockBookingService.getBookingById.mockResolvedValue({
        title: 'Test Booking',
        location: { city: 'Test', country: 'Test' },
        dateRange: { checkIn: new Date(), checkOut: new Date() }
      } as any);
      mockSwapMatchingService.analyzeSwapCompatibility.mockResolvedValue(mockCompatibilityAnalysis as any);

      // Mock preferences to reject low compatibility
      const mockPreferencesService = service['preferencesService'] as jest.Mocked<NotificationPreferencesService>;
      mockPreferencesService.shouldSendNotification = jest.fn().mockResolvedValue(false);

      mockNotificationService.sendNotification = jest.fn();

      // Execute
      await service.sendBrowseProposalReceivedNotification(proposalData);

      // Verify notification was not sent
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('sendBrowseProposalConfirmedNotification', () => {
    it('should send confirmation notification with enhanced content', async () => {
      const confirmationData = {
        proposalId: 'proposal-123',
        sourceSwapId: 'swap-456',
        targetSwapId: 'swap-789',
        proposerId: 'user-123',
        status: 'pending_review'
      };

      // Setup basic mocks
      mockSwapRepository.findById.mockResolvedValue({ sourceBookingId: 'booking-123' } as any);
      mockBookingService.getBookingById.mockResolvedValue({
        title: 'Test Booking',
        location: { city: 'Test', country: 'Test' },
        dateRange: { checkIn: new Date(), checkOut: new Date() }
      } as any);

      const mockPreferencesService = service['preferencesService'] as jest.Mocked<NotificationPreferencesService>;
      mockPreferencesService.generateEnhancedNotificationContent = jest.fn().mockResolvedValue({
        subject: 'Confirmation Subject',
        content: 'Confirmation Content',
        metadata: {
          priority: 'normal',
          category: 'browse_proposal',
          includesComparison: true
        }
      });

      mockNotificationService.sendNotification = jest.fn().mockResolvedValue(undefined);

      // Execute
      await service.sendBrowseProposalConfirmedNotification(confirmationData);

      // Verify
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        'browse_proposal_confirmed',
        'user-123',
        expect.objectContaining({
          proposalId: 'proposal-123',
          status: 'pending_review',
          estimatedResponseTime: '2-3 business days'
        })
      );
    });
  });
});