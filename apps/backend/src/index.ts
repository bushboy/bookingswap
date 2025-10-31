import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

import { logger, enhancedLogger } from './utils/logger';
import {
  requestIdMiddleware,
  errorHandler,
  notFoundHandler,
  asyncHandler
} from './middleware/errorHandler';
import {
  performanceMonitoring,
  errorRateTracking,
  HealthMonitor
} from './utils/monitoring';
import { createDatabasePool, getDatabaseConfig } from './database/config';
import { initializeCache } from './database/cache/config';
import { createHederaService } from './services/hedera/factory';
import { WalletService } from './services/hedera/WalletService';
import { HederaBalanceService } from './services/hedera/HederaBalanceService';
import { BalanceCalculator } from '@booking-swap/shared';
import { AuthService } from './services/auth/AuthService';
import { AuthMiddleware } from './middleware/auth';
import { PasswordResetCleanupService } from './services/auth/PasswordResetCleanupService';
import { getCleanupConfig, validateCleanupConfig } from './services/auth/cleanup-config';
import { ConfigurationValidator } from './services/startup/ConfigurationValidator';
import { StartupIntegrityService } from './services/startup/StartupIntegrityService';
import { ServiceValidationStartup } from './services/startup/ServiceValidationStartup';
import { PerformanceMonitor } from './services/monitoring/PerformanceMonitor';
import { RedisService } from './database/cache/RedisService';

import { UserRepository } from './database/repositories/UserRepository';
import { BookingRepository } from './database/repositories/BookingRepository';
import { SwapRepository } from './database/repositories/SwapRepository';
import { SwapTargetingRepository } from './database/repositories/SwapTargetingRepository';
import { AuctionRepository } from './database/repositories/AuctionRepository';
import { PaymentRepository } from './database/repositories/PaymentRepository';
import { NotificationRepository } from './database/repositories/NotificationRepository';
import { PasswordResetTokenRepository } from './database/repositories/PasswordResetTokenRepository';

import { AuthController } from './controllers/AuthController';
import { UserController } from './controllers/UserController';
import { BookingController } from './controllers/BookingController';
import { SwapController } from './controllers/SwapController';
import { ProposalController } from './controllers/ProposalController';
import { CompletionController } from './controllers/CompletionController';
import { NotificationController } from './controllers/NotificationController';

import { BookingServiceFactory } from './services/booking/factory';
import { createSwapProposalService, createSwapResponseService, createProposalAcceptanceService, createSwapExpirationService, createSwapCompletionOrchestrator } from './services/swap/factory';
import { CompletionValidationService } from './services/swap/CompletionValidationService';
import { SwapExpirationService } from './services/swap/SwapExpirationService';
import { SwapMatchingService } from './services/swap/SwapMatchingService';
import { SwapTargetingService } from './services/swap/SwapTargetingService';
import { SwapTargetingController } from './controllers/SwapTargetingController';
import { createAuctionManagementService } from './services/auction/factory';
import { createPaymentProcessingService } from './services/payment/factory';
import { SwapOfferWorkflowServiceImpl } from './services/swap/SwapOfferWorkflowService';
import { EnhancedPaymentTransactionServiceImpl } from './services/payment/EnhancedPaymentTransactionService';
import { EnhancedAuctionProposalServiceImpl } from './services/auction/EnhancedAuctionProposalService';
import { NotificationService, WebSocketService } from './services/notification';
import { EmailService } from './services/email/EmailService';

import { createAuthRoutes } from './routes/auth';
import { createUserRoutes } from './routes/users';
import { createBookingRoutes } from './routes/bookings';
import { createSwapRoutes } from './routes/swaps';
import { createProposalRoutes, createUserProposalRoutes } from './routes/proposals';
import { createCompletionRoutes } from './routes/completions';
import completionAuditRoutes from './routes/completionAudit';
import { createTargetingRoutes } from './routes/targeting';
import { createAuctionRoutes } from './routes/auctions';
import { createPaymentRoutes } from './routes/payments';
import { createNotificationRoutes } from './routes/notifications';
import { createAdminRouter } from './routes/admin';
import { createMonitoringRoutes } from './routes/monitoring';
import { createDebugRoutes } from './routes/debug';
import { createTargetingDebugRoutes } from './routes/targetingDebug';
import { initializeAuthDebugUtils } from './utils/authDebug';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function createApp() {
  const app = express();
  const server = createServer(app);

  // Request tracking middleware (must be first)
  app.use(requestIdMiddleware);

  // Performance monitoring
  app.use(performanceMonitoring);

  // Error rate tracking
  app.use(errorRateTracking);

  // Security middleware
  app.use(helmet());

  // CORS configuration with multiple allowed origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://gyratory-lirellate-elvira.ngrok-free.app',
    process.env.FRONTEND_URL
  ].filter(Boolean); // Remove undefined values

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later',
        category: 'rate_limiting',
      },
    },
  });
  app.use(limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize database connections
  const dbPool = createDatabasePool(getDatabaseConfig());
  const redisClient = await initializeCache();

  // Initialize performance monitoring
  const redisService = new RedisService(redisClient);
  const performanceMonitor = new PerformanceMonitor(dbPool, redisService);

  // Start performance monitoring with 60-second intervals
  performanceMonitor.startMonitoring(60000);

  // Initialize health monitoring
  const healthMonitor = HealthMonitor.getInstance();

  // Register health checks
  healthMonitor.registerHealthCheck('database', async () => {
    const startTime = Date.now();
    try {
      await dbPool.query('SELECT 1');
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message,
      };
    }
  });

  healthMonitor.registerHealthCheck('cache', async () => {
    const startTime = Date.now();
    try {
      await redisClient.ping();
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message,
      };
    }
  });

  healthMonitor.registerHealthCheck('blockchain', async () => {
    const startTime = Date.now();
    try {
      // This would check Hedera network connectivity
      // For now, we'll simulate a check
      await new Promise(resolve => setTimeout(resolve, 10));
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message,
      };
    }
  });

  // Register NFT-specific health check
  healthMonitor.registerHealthCheck('nft_operations', async () => {
    const startTime = Date.now();
    try {
      const { NFTMonitoringService } = await import('./services/hedera/NFTMonitoringService');
      const nftMonitoring = NFTMonitoringService.getInstance();
      const healthStatus = nftMonitoring.getHealthStatus();

      return {
        status: healthStatus.status === 'healthy' ? 'healthy' :
          healthStatus.status === 'degraded' ? 'degraded' : 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          errorRate: healthStatus.errorRate,
          averageResponseTime: healthStatus.averageResponseTime,
          operationCounts: healthStatus.operationCounts,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message,
      };
    }
  });

  // Initialize repositories with performance monitoring
  const userRepository = new UserRepository(dbPool);
  const bookingRepository = new BookingRepository(dbPool);
  const swapRepository = new SwapRepository(dbPool, performanceMonitor);
  const swapTargetingRepository = new SwapTargetingRepository(dbPool);
  const auctionRepository = new AuctionRepository(dbPool);
  const paymentRepository = new PaymentRepository(dbPool);
  const notificationRepository = new NotificationRepository(dbPool);
  const passwordResetTokenRepository = new PasswordResetTokenRepository(dbPool);

  // Initialize Hedera services
  const hederaService = createHederaService();
  const walletService = new WalletService();

  // Initialize email service (optional for basic auth)
  let emailService: EmailService | undefined;
  try {
    emailService = new EmailService();
    enhancedLogger.info('Email service initialized successfully');
  } catch (error) {
    enhancedLogger.warn('Email service initialization failed, continuing without email features', {
      error: error.message
    });
    emailService = undefined;
  }

  // Initialize authentication services
  const authService = new AuthService(
    userRepository,
    walletService,
    passwordResetTokenRepository,
    emailService,
    undefined, // jwtTokenBlacklistRepository - not initialized yet
    process.env.JWT_SECRET,
    process.env.JWT_EXPIRES_IN || '24h'
  );
  const authMiddleware = new AuthMiddleware(authService, userRepository);

  // Initialize authentication debug utilities
  initializeAuthDebugUtils(authService, userRepository);

  // Initialize password reset cleanup service
  const cleanupConfig = getCleanupConfig();
  validateCleanupConfig(cleanupConfig);
  const passwordResetCleanupService = new PasswordResetCleanupService(
    passwordResetTokenRepository,
    cleanupConfig
  );

  // Start cleanup service
  passwordResetCleanupService.start();

  // Initialize WebSocket service
  const webSocketService = new WebSocketService(server);

  // Initialize notification service
  const notificationService = new NotificationService(
    notificationRepository,
    userRepository,
    webSocketService
  );

  // Initialize booking service
  const bookingService = BookingServiceFactory.getInstance({
    dbPool,
    hederaService,
  });

  // Initialize auction and payment services first (required by swap services)
  const auctionService = createAuctionManagementService(dbPool);
  const paymentService = createPaymentProcessingService(dbPool);

  // Initialize swap services
  const swapProposalService = createSwapProposalService(
    dbPool,
    bookingService,
    hederaService,
    auctionService,
    paymentService
  );

  // Initialize SwapExpirationService with proper dependencies
  const swapExpirationService = createSwapExpirationService(swapProposalService);
  enhancedLogger.info('SwapExpirationService initialized successfully', {
    checkIntervalMinutes: parseInt(process.env.SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES || '5')
  });

  // Register SwapExpirationService health check
  healthMonitor.registerHealthCheck('swap_expiration', async () => {
    const startTime = Date.now();
    try {
      const status = swapExpirationService.getStatus();

      // Determine health status based on service state and recent errors
      let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!status.isRunning) {
        healthStatus = 'unhealthy';
      } else if (status.lastError) {
        // Check if error is recent (within last 10 minutes)
        const errorAge = Date.now() - status.lastError.timestamp.getTime();
        if (errorAge < 10 * 60 * 1000) {
          healthStatus = 'degraded';
        }
      }

      return {
        status: healthStatus,
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          isRunning: status.isRunning,
          checkIntervalMs: status.checkIntervalMs,
          nextCheckIn: status.nextCheckIn,
          startedAt: status.startedAt?.toISOString(),
          lastCheckAt: status.lastCheckAt?.toISOString(),
          totalChecksPerformed: status.totalChecksPerformed,
          totalSwapsProcessed: status.totalSwapsProcessed,
          lastError: status.lastError ? {
            message: status.lastError.message,
            timestamp: status.lastError.timestamp.toISOString(),
            ageMs: Date.now() - status.lastError.timestamp.getTime()
          } : undefined
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  const swapResponseService = createSwapResponseService(
    dbPool,
    bookingService,
    hederaService,
    auctionService,
    paymentService
  );

  // Initialize swap matching service
  const swapMatchingService = new SwapMatchingService(
    swapRepository,
    bookingService,
    swapProposalService,
    userRepository,
    hederaService,
    notificationService
  );

  // Initialize swap targeting service
  const swapTargetingService = new SwapTargetingService(
    swapTargetingRepository,
    swapRepository,
    swapProposalService,
    auctionRepository,
    dbPool
  );

  // Initialize enhanced services for swap offer workflow
  const enhancedPaymentService = new EnhancedPaymentTransactionServiceImpl(dbPool, paymentRepository);
  const enhancedAuctionService = new EnhancedAuctionProposalServiceImpl(dbPool);
  const swapOfferWorkflowService = new SwapOfferWorkflowServiceImpl(
    dbPool,
    enhancedPaymentService,
    enhancedAuctionService
  );

  // Initialize service validation and register critical services
  const serviceValidationStartup = ServiceValidationStartup.getInstance();

  // Register critical services for validation
  serviceValidationStartup.registerBookingService(bookingService, true);
  serviceValidationStartup.registerSwapProposalService(swapProposalService, true);
  serviceValidationStartup.registerAuthService(authService, true);

  // Initialize proposal acceptance service
  const proposalAcceptanceService = createProposalAcceptanceService(
    dbPool,
    bookingService,
    hederaService,
    paymentService
  );

  // Initialize completion services
  const completionOrchestrator = createSwapCompletionOrchestrator(
    dbPool,
    hederaService,
    notificationService
  );
  const completionValidationService = new CompletionValidationService(dbPool);

  // Initialize Hedera balance service
  const hederaBalanceService = new HederaBalanceService(hederaService);

  // Initialize balance calculator
  const balanceCalculator = new BalanceCalculator();

  // Initialize controllers with performance monitoring
  const authController = new AuthController(authService);
  const userController = new UserController(
    userRepository,
    bookingRepository,
    swapRepository
  );
  const bookingController = new BookingController(bookingService, swapRepository);
  const swapController = new SwapController(swapProposalService, swapResponseService, swapMatchingService, swapTargetingService, swapRepository, auctionService, paymentService, swapOfferWorkflowService, hederaBalanceService, balanceCalculator, performanceMonitor);
  const proposalController = new ProposalController(proposalAcceptanceService, swapRepository, completionOrchestrator, completionValidationService);
  const completionController = new CompletionController(completionOrchestrator, completionValidationService, swapRepository);
  const swapTargetingController = new SwapTargetingController(swapTargetingService);
  const notificationController = new NotificationController(notificationService);

  // Health check endpoints
  app.get('/health', asyncHandler(async (req, res) => {
    const healthStatus = await healthMonitor.getHealthStatus();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  }));

  app.get('/health/ready', asyncHandler(async (req, res) => {
    const healthStatus = await healthMonitor.getHealthStatus();
    if (healthStatus.status === 'healthy') {
      res.json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready', reason: 'services unhealthy' });
    }
  }));

  app.get('/health/live', (req, res) => {
    res.json({ status: 'alive' });
  });

  // API routes
  app.use('/api/auth', createAuthRoutes(authController, authMiddleware));
  app.use('/api/users', createUserRoutes(userController, authMiddleware));
  app.use('/api/bookings', createBookingRoutes(bookingController, authMiddleware));
  app.use('/api/swaps', createSwapRoutes(swapController, authMiddleware, completionController));
  app.use('/api/proposals', createProposalRoutes(proposalController, authMiddleware));
  app.use('/api/completions', createCompletionRoutes(completionController, authMiddleware));
  app.use('/api/completions', completionAuditRoutes);
  app.use('/api/users', createUserProposalRoutes(proposalController, authMiddleware));
  app.use('/api', createTargetingRoutes(swapTargetingController, authMiddleware));
  app.use('/api/auctions', createAuctionRoutes(swapController, authMiddleware));
  app.use('/api/payments', createPaymentRoutes(swapController, authMiddleware));
  app.use('/api/notifications', createNotificationRoutes(notificationController, authMiddleware));
  app.use('/api/admin', createAdminRouter(dbPool));
  app.use('/api/monitoring', await createMonitoringRoutes(passwordResetCleanupService, performanceMonitor));
  app.use('/api/debug', createDebugRoutes(authService, userRepository));
  app.use('/api/debug/targeting', createTargetingDebugRoutes(
    dbPool,
    swapTargetingRepository,
    swapRepository,
    swapProposalService,
    authService,
    userRepository
  ));

  // 404 handler (must be before error handler)
  app.use('*', notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return { app, server, passwordResetCleanupService, performanceMonitor, swapExpirationService };
}

async function startServer() {
  // Declare variables that need to be accessible in shutdown handler
  let passwordResetCleanupService: PasswordResetCleanupService | undefined;
  let performanceMonitor: PerformanceMonitor | undefined;
  let swapExpirationService: SwapExpirationService | undefined;
  let swapExpirationConfig: any;
  let serviceHealthMonitor: any;
  let serviceRecoveryManager: any;

  try {
    enhancedLogger.info('Starting Booking Swap Platform Backend...');

    // Validate configuration before starting the application
    const configValidator = ConfigurationValidator.getInstance();
    const validationResult = await configValidator.validateStartupConfiguration();

    if (!validationResult.success) {
      enhancedLogger.error('Configuration validation failed, cannot start server', {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      });
      process.exit(1);
    }

    if (validationResult.warnings.length > 0) {
      enhancedLogger.warn('Configuration validation completed with warnings', {
        warnings: validationResult.warnings,
      });
    }

    // Perform database integrity checks on startup
    const startupIntegrityService = StartupIntegrityService.getInstance();

    // First perform a quick health check
    const healthCheckPassed = await startupIntegrityService.performQuickHealthCheck();
    if (!healthCheckPassed) {
      enhancedLogger.error('Database health check failed, cannot start server');
      process.exit(1);
    }

    // Then perform comprehensive integrity checks
    const integrityResult = await startupIntegrityService.performStartupIntegrityChecks();

    // Verify foreign key validation optimization indexes
    enhancedLogger.info('Verifying foreign key validation optimization indexes');
    const indexVerification = await startupIntegrityService.verifyValidationOptimizationIndexes();

    if (!indexVerification.allIndexesPresent) {
      enhancedLogger.warn('Foreign key validation optimization indexes missing', {
        missingCount: indexVerification.missingIndexes.length,
        missingIndexes: indexVerification.missingIndexes,
        recommendations: indexVerification.recommendations
      });
    } else {
      enhancedLogger.info('All foreign key validation optimization indexes are present');
    }

    // Analyze validation performance (optional, for monitoring)
    if (process.env.ANALYZE_VALIDATION_PERFORMANCE === 'true') {
      await startupIntegrityService.analyzeValidationPerformance();
    }

    if (integrityResult.integrityStatus === 'critical') {
      enhancedLogger.error('Critical database integrity issues detected', {
        criticalIssues: integrityResult.issues.filter(i => i.type === 'critical').length,
        totalIssues: integrityResult.issues.length,
        recommendations: integrityResult.recommendations
      });

      // In production, you might want to exit on critical issues
      // For now, we'll log and continue but this should be configurable
      if (process.env.NODE_ENV === 'production' && process.env.STRICT_INTEGRITY_CHECKS === 'true') {
        enhancedLogger.error('Strict integrity checks enabled - exiting due to critical issues');
        process.exit(1);
      }
    } else if (integrityResult.integrityStatus === 'warning') {
      enhancedLogger.warn('Database integrity warnings detected at startup', {
        warningCount: integrityResult.warnings.length,
        recommendations: integrityResult.recommendations
      });
    } else {
      enhancedLogger.info('Database integrity checks passed - system is healthy');
    }

    // Perform service validation before starting the server
    enhancedLogger.info('Performing service validation checks');
    const { app, server, passwordResetCleanupService: cleanupService, performanceMonitor: perfMonitor, swapExpirationService: swapExpService } = await createApp();

    // Assign to variables accessible in shutdown handler
    passwordResetCleanupService = cleanupService;
    performanceMonitor = perfMonitor;
    swapExpirationService = swapExpService;

    // Get service validation startup instance and perform validation
    const serviceValidationStartup = ServiceValidationStartup.getInstance();
    const serviceValidationResult = await serviceValidationStartup.performStartupValidation();

    if (!serviceValidationResult.success) {
      enhancedLogger.error('Service validation failed - critical services are not properly configured', {
        criticalFailures: serviceValidationResult.criticalFailures,
        totalServices: serviceValidationResult.totalServices,
        validServices: serviceValidationResult.validServices
      });

      if (process.env.NODE_ENV === 'production' || process.env.STRICT_SERVICE_VALIDATION === 'true') {
        enhancedLogger.error('Strict service validation enabled - exiting due to critical service failures');
        process.exit(1);
      } else {
        enhancedLogger.warn('Service validation failed but continuing in development mode');
      }
    } else if (serviceValidationResult.warnings.length > 0) {
      enhancedLogger.warn('Service validation completed with warnings', {
        warnings: serviceValidationResult.warnings,
        validServices: serviceValidationResult.validServices,
        totalServices: serviceValidationResult.totalServices
      });
    } else {
      enhancedLogger.info('All service validations passed successfully', {
        validServices: serviceValidationResult.validServices,
        totalServices: serviceValidationResult.totalServices
      });
    }

    // Get swap expiration configuration for use in startup and shutdown
    const { validateAndGetSwapExpirationConfig } = await import('./services/swap/expiration-config');
    swapExpirationConfig = validateAndGetSwapExpirationConfig();

    // Start service health monitoring
    enhancedLogger.info('Starting service health monitoring');
    const { ServiceHealthMonitor } = await import('./services/monitoring/ServiceHealthMonitor');
    serviceHealthMonitor = ServiceHealthMonitor.getInstance();
    serviceHealthMonitor.startMonitoring(60000); // Check every minute

    // Initialize and start service recovery
    enhancedLogger.info('Initializing service recovery system');
    const { serviceRecoveryManager: recoveryManager } = await import('./services/recovery/ServiceRecoveryManager');
    serviceRecoveryManager = recoveryManager;
    const { FallbackBookingService } = await import('./services/recovery/FallbackBookingService');

    try {
      // Initialize ServiceRecoveryManager first
      await serviceRecoveryManager.initialize();
      enhancedLogger.info('ServiceRecoveryManager initialized successfully', {
        category: 'service_recovery',
        phase: 'server_startup_init_success'
      });

      // Register fallback services after initialization
      const fallbackBookingService = new FallbackBookingService();
      serviceRecoveryManager.registerFallbackService('BookingService', fallbackBookingService);

      // Start recovery monitoring
      serviceRecoveryManager.startRecovery(30000); // Check every 30 seconds
      enhancedLogger.info('Service recovery monitoring started successfully', {
        category: 'service_recovery',
        phase: 'server_startup_monitoring_started',
        monitoringInterval: 30000
      });

    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      enhancedLogger.error('Failed to initialize service recovery system', {
        error: errorInstance.message,
        stack: errorInstance.stack,
        category: 'service_recovery',
        phase: 'server_startup_init_failed'
      });

      // Get detailed error information for troubleshooting
      try {
        const errorSummary = serviceRecoveryManager.getErrorSummary();
        const systemStatus = serviceRecoveryManager.getSystemStatus();

        enhancedLogger.warn('Service recovery system error details', {
          category: 'service_recovery',
          phase: 'server_startup_error_analysis',
          systemStatus: systemStatus.status,
          gracefulDegradationMode: systemStatus.gracefulDegradationMode,
          totalErrors: errorSummary.totalErrors,
          errorsByPhase: errorSummary.errorsByPhase,
          recommendations: errorSummary.recommendations,
          failedInitializationPhases: errorSummary.initializationPhases
            .filter((p: any) => !p.success)
            .map((p: any) => ({ name: p.name, error: p.error?.message }))
        });

        // Attempt to start recovery monitoring even in degraded mode
        try {
          serviceRecoveryManager.startRecovery(30000);
          enhancedLogger.info('Service recovery monitoring started in degraded mode', {
            category: 'service_recovery',
            phase: 'server_startup_degraded_monitoring_started'
          });
        } catch (startError: unknown) {
          const startErrorInstance = startError instanceof Error ? startError : new Error(String(startError));
          enhancedLogger.warn('Failed to start recovery monitoring even in degraded mode', {
            category: 'service_recovery',
            phase: 'server_startup_degraded_monitoring_failed',
            error: startErrorInstance.message
          });
        }

      } catch (analysisError: unknown) {
        const analysisErrorInstance = analysisError instanceof Error ? analysisError : new Error(String(analysisError));
        enhancedLogger.warn('Failed to analyze service recovery errors', {
          category: 'service_recovery',
          phase: 'server_startup_error_analysis_failed',
          error: analysisErrorInstance.message
        });
      }

      // Continue server startup even if service recovery fails to initialize
      // This provides graceful degradation as specified in requirements
      enhancedLogger.warn('Continuing server startup with service recovery system in degraded mode', {
        category: 'service_recovery',
        phase: 'server_startup_graceful_degradation',
        impact: 'Limited service recovery capabilities available'
      });
    }

    server.listen(PORT, async () => {
      enhancedLogger.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
      enhancedLogger.info('WebSocket server initialized');

      // Start SwapExpirationService with startup delay to ensure stability
      const { shouldEnableSwapExpirationService } = await import('./services/swap/expiration-config');

      if (shouldEnableSwapExpirationService()) {
        setTimeout(() => {
          try {
            swapExpirationService.start();
            enhancedLogger.info('SwapExpirationService started successfully after startup delay', {
              startupDelayMs: swapExpirationConfig.startupDelayMs,
              checkIntervalMinutes: swapExpirationConfig.checkIntervalMinutes,
              enableDetailedLogging: swapExpirationConfig.enableDetailedLogging,
              enableMetrics: swapExpirationConfig.enableMetrics
            });
          } catch (error) {
            enhancedLogger.error('Failed to start SwapExpirationService', {
              error: error instanceof Error ? error.message : String(error),
              startupDelayMs: swapExpirationConfig.startupDelayMs
            });
          }
        }, swapExpirationConfig.startupDelayMs);
      } else {
        enhancedLogger.info('SwapExpirationService disabled by configuration');
      }
    });

    // Enhanced graceful shutdown with proper resource cleanup
    const gracefulShutdown = async (signal: string) => {
      enhancedLogger.info(`${signal} received, shutting down gracefully`);

      const shutdownStartTime = new Date();
      const shutdownPhases: { name: string; success: boolean; error?: Error; duration?: number }[] = [];

      server.close(async () => {
        try {
          // Phase 1: Stop password reset cleanup service
          const cleanupPhaseStart = new Date();
          try {
            if (passwordResetCleanupService) {
              passwordResetCleanupService.stop();
              shutdownPhases.push({
                name: 'password_reset_cleanup_stop',
                success: true,
                duration: new Date().getTime() - cleanupPhaseStart.getTime()
              });
              enhancedLogger.info('Password reset cleanup service stopped');
            } else {
              shutdownPhases.push({
                name: 'password_reset_cleanup_stop',
                success: true,
                duration: new Date().getTime() - cleanupPhaseStart.getTime()
              });
              enhancedLogger.info('Password reset cleanup service was not initialized');
            }
          } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            shutdownPhases.push({
              name: 'password_reset_cleanup_stop',
              success: false,
              error: errorInstance,
              duration: new Date().getTime() - cleanupPhaseStart.getTime()
            });
            enhancedLogger.warn('Error stopping password reset cleanup service', { error: errorInstance.message });
          }

          // Phase 2: Stop SwapExpirationService with timeout handling
          const swapExpirationPhaseStart = new Date();
          try {
            if (swapExpirationService) {
              const serviceStatus = swapExpirationService.getStatus();
              const shutdownTimeoutMs = swapExpirationConfig.shutdownTimeoutMs;

              enhancedLogger.info('Stopping SwapExpirationService gracefully', {
                isRunning: serviceStatus.isRunning,
                totalChecksPerformed: serviceStatus.totalChecksPerformed,
                totalSwapsProcessed: serviceStatus.totalSwapsProcessed,
                startedAt: serviceStatus.startedAt?.toISOString(),
                lastCheckAt: serviceStatus.lastCheckAt?.toISOString(),
                shutdownTimeoutMs,
                phase: 'swap_expiration_service_shutdown_start'
              });

              const shutdownResult = await swapExpirationService.stopGracefully(shutdownTimeoutMs);

              const finalStatus = swapExpirationService.getStatus();
              const shutdownDuration = new Date().getTime() - swapExpirationPhaseStart.getTime();

              if (shutdownResult.success) {
                shutdownPhases.push({
                  name: 'swap_expiration_service_stop',
                  success: true,
                  duration: shutdownDuration
                });

                enhancedLogger.info('SwapExpirationService stopped successfully', {
                  wasRunning: serviceStatus.isRunning,
                  isNowStopped: !finalStatus.isRunning,
                  totalChecksPerformed: finalStatus.totalChecksPerformed,
                  totalSwapsProcessed: finalStatus.totalSwapsProcessed,
                  shutdownDuration,
                  timedOut: shutdownResult.timedOut,
                  phase: 'swap_expiration_service_shutdown_success'
                });
              } else {
                const errorMessage = shutdownResult.timedOut
                  ? `Graceful shutdown timed out after ${shutdownTimeoutMs}ms`
                  : shutdownResult.error?.message || 'Unknown shutdown error';

                shutdownPhases.push({
                  name: 'swap_expiration_service_stop',
                  success: false,
                  error: new Error(errorMessage),
                  duration: shutdownDuration
                });

                if (shutdownResult.timedOut) {
                  enhancedLogger.warn('SwapExpirationService graceful shutdown timed out, forcing cleanup', {
                    shutdownTimeoutMs,
                    shutdownDuration,
                    phase: 'swap_expiration_service_shutdown_timeout',
                    impact: 'Service forced to stop, current operations may have been interrupted'
                  });
                } else {
                  enhancedLogger.error('SwapExpirationService graceful shutdown failed', {
                    error: shutdownResult.error?.message,
                    shutdownDuration,
                    phase: 'swap_expiration_service_shutdown_error',
                    impact: 'Service may not have stopped cleanly'
                  });
                }
              }
            } else {
              shutdownPhases.push({
                name: 'swap_expiration_service_stop',
                success: true,
                duration: new Date().getTime() - swapExpirationPhaseStart.getTime()
              });
              enhancedLogger.info('SwapExpirationService was not initialized - skipping shutdown', {
                phase: 'swap_expiration_service_shutdown_skip'
              });
            }
          } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            const shutdownDuration = new Date().getTime() - swapExpirationPhaseStart.getTime();

            shutdownPhases.push({
              name: 'swap_expiration_service_stop',
              success: false,
              error: errorInstance,
              duration: shutdownDuration
            });

            enhancedLogger.error('Unexpected error during SwapExpirationService shutdown', {
              error: errorInstance.message,
              stack: errorInstance.stack,
              shutdownDuration,
              phase: 'swap_expiration_service_shutdown_unexpected_error',
              impact: 'Service shutdown failed unexpectedly, but application shutdown will continue'
            });

            // Force cleanup on unexpected error
            try {
              swapExpirationService?.stop();
              enhancedLogger.info('Forced SwapExpirationService cleanup completed after unexpected error');
            } catch (cleanupError) {
              enhancedLogger.warn('Failed to force cleanup SwapExpirationService after unexpected error', {
                cleanupError: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error'
              });
            }
          }

          // Phase 3: Stop performance monitoring
          const performancePhaseStart = new Date();
          try {
            if (performanceMonitor) {
              performanceMonitor.stopMonitoring();
              shutdownPhases.push({
                name: 'performance_monitoring_stop',
                success: true,
                duration: new Date().getTime() - performancePhaseStart.getTime()
              });
              enhancedLogger.info('Performance monitoring stopped');
            } else {
              shutdownPhases.push({
                name: 'performance_monitoring_stop',
                success: true,
                duration: new Date().getTime() - performancePhaseStart.getTime()
              });
              enhancedLogger.info('Performance monitoring was not initialized');
            }
          } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            shutdownPhases.push({
              name: 'performance_monitoring_stop',
              success: false,
              error: errorInstance,
              duration: new Date().getTime() - performancePhaseStart.getTime()
            });
            enhancedLogger.warn('Error stopping performance monitoring', { error: errorInstance.message });
          }

          // Phase 4: Stop health monitoring
          const healthPhaseStart = new Date();
          try {
            const healthMonitor = HealthMonitor.getInstance();
            healthMonitor.stopHealthChecking();
            shutdownPhases.push({
              name: 'health_monitoring_stop',
              success: true,
              duration: new Date().getTime() - healthPhaseStart.getTime()
            });
            enhancedLogger.info('Health monitoring stopped');
          } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            shutdownPhases.push({
              name: 'health_monitoring_stop',
              success: false,
              error: errorInstance,
              duration: new Date().getTime() - healthPhaseStart.getTime()
            });
            enhancedLogger.warn('Error stopping health monitoring', { error: errorInstance.message });
          }

          // Phase 5: Stop service health monitoring
          const serviceHealthPhaseStart = new Date();
          try {
            if (serviceHealthMonitor) {
              serviceHealthMonitor.stopMonitoring();
              shutdownPhases.push({
                name: 'service_health_monitoring_stop',
                success: true,
                duration: new Date().getTime() - serviceHealthPhaseStart.getTime()
              });
              enhancedLogger.info('Service health monitoring stopped');
            } else {
              shutdownPhases.push({
                name: 'service_health_monitoring_stop',
                success: true,
                duration: new Date().getTime() - serviceHealthPhaseStart.getTime()
              });
              enhancedLogger.info('Service health monitoring was not initialized');
            }
          } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            shutdownPhases.push({
              name: 'service_health_monitoring_stop',
              success: false,
              error: errorInstance,
              duration: new Date().getTime() - serviceHealthPhaseStart.getTime()
            });
            enhancedLogger.warn('Error stopping service health monitoring', { error: errorInstance.message });
          }

          // Phase 6: Stop service recovery monitoring and shutdown recovery system
          const recoveryPhaseStart = new Date();
          try {
            if (serviceRecoveryManager) {
              // Check if the service recovery manager is initialized before attempting shutdown
              const initStatus = serviceRecoveryManager.getInitializationStatus();

              enhancedLogger.info('Shutting down service recovery system', {
                category: 'service_recovery',
                phase: 'server_shutdown_start',
                isInitialized: initStatus.isInitialized,
                hasInitializationError: !!initStatus.initializationError
              });

              // Stop recovery monitoring first (handles both initialized and uninitialized states)
              try {
                serviceRecoveryManager.stopRecovery();
                enhancedLogger.info('Service recovery monitoring stopped', {
                  category: 'service_recovery',
                  phase: 'server_shutdown_monitoring_stopped'
                });
              } catch (stopError: unknown) {
                const stopErrorInstance = stopError instanceof Error ? stopError : new Error(String(stopError));
                enhancedLogger.warn('Error stopping service recovery monitoring', {
                  category: 'service_recovery',
                  phase: 'server_shutdown_monitoring_stop_error',
                  error: stopErrorInstance.message
                });
                // Continue with shutdown even if stop fails
              }

              // Shutdown the recovery system (handles cleanup regardless of initialization state)
              serviceRecoveryManager.shutdown();

              shutdownPhases.push({
                name: 'service_recovery_shutdown',
                success: true,
                duration: new Date().getTime() - recoveryPhaseStart.getTime()
              });

              enhancedLogger.info('Service recovery system shutdown completed', {
                category: 'service_recovery',
                phase: 'server_shutdown_complete'
              });
            } else {
              shutdownPhases.push({
                name: 'service_recovery_shutdown',
                success: true,
                duration: new Date().getTime() - recoveryPhaseStart.getTime()
              });
              enhancedLogger.info('Service recovery system was not initialized');
            }
          } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            shutdownPhases.push({
              name: 'service_recovery_shutdown',
              success: false,
              error: errorInstance,
              duration: new Date().getTime() - recoveryPhaseStart.getTime()
            });
            enhancedLogger.warn('Error during service recovery system shutdown', {
              error: errorInstance.message,
              category: 'service_recovery',
              phase: 'server_shutdown_error'
            });
          }

          const totalShutdownDuration = new Date().getTime() - shutdownStartTime.getTime();
          const successfulPhases = shutdownPhases.filter(p => p.success).length;

          enhancedLogger.info('Server shutdown complete', {
            totalDuration: totalShutdownDuration,
            successfulPhases,
            totalPhases: shutdownPhases.length,
            shutdownPhases: shutdownPhases.map(p => ({
              name: p.name,
              success: p.success,
              duration: p.duration,
              error: p.error?.message
            }))
          });

          process.exit(0);
        } catch (error: unknown) {
          const errorInstance = error instanceof Error ? error : new Error(String(error));
          const totalShutdownDuration = new Date().getTime() - shutdownStartTime.getTime();

          enhancedLogger.error('Error during shutdown', {
            error: errorInstance.message,
            totalDuration: totalShutdownDuration,
            completedPhases: shutdownPhases.filter(p => p.success).length,
            totalPhases: shutdownPhases.length
          });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        enhancedLogger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      enhancedLogger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      enhancedLogger.error('Unhandled rejection', { reason, promise });
      process.exit(1);
    });

  } catch (error: unknown) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    enhancedLogger.error('Failed to start server', { error: errorInstance.message });
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

export { createApp };
