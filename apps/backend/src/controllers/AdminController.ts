import { Request, Response } from 'express';
import { AdminService } from '../services/admin/AdminService';
import { SwapPlatformError } from '@booking-swap/shared';
import { logger } from '../utils/logger';

export class AdminController {
  constructor(private adminService: AdminService) {}

  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await this.adminService.getPlatformStatistics();
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Error fetching admin statistics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch platform statistics'
      });
    }
  }

  async getRecentActivity(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await this.adminService.getRecentActivity(limit);
      
      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      logger.error('Error fetching recent activity', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent activity'
      });
    }
  }

  async getDisputes(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as string;
      const disputes = await this.adminService.getDisputes(status);
      
      res.json({
        success: true,
        data: disputes
      });
    } catch (error) {
      logger.error('Error fetching disputes', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch disputes'
      });
    }
  }

  async createDispute(req: Request, res: Response): Promise<void> {
    try {
      const disputeData = req.body;
      const dispute = await this.adminService.createDispute(disputeData);
      
      res.status(201).json({
        success: true,
        data: dispute
      });
    } catch (error) {
      logger.error('Error creating dispute', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create dispute'
      });
    }
  }

  async resolveDispute(req: Request, res: Response): Promise<void> {
    try {
      const { disputeId } = req.params;
      const { action, notes } = req.body;
      const adminId = req.admin!.id;

      const resolution = {
        action,
        notes,
        resolvedBy: adminId,
        resolvedAt: new Date()
      };

      const dispute = await this.adminService.resolveDispute(
        disputeId, 
        resolution, 
        adminId
      );
      
      res.json({
        success: true,
        data: dispute
      });
    } catch (error) {
      logger.error('Error resolving dispute', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to resolve dispute'
      });
    }
  }

  async flagUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { reason, severity, expiresAt } = req.body;
      const adminId = req.admin!.id;

      const flag = {
        reason,
        flaggedBy: adminId,
        flaggedAt: new Date(),
        severity,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined
      };

      await this.adminService.flagUser(userId, flag);
      
      res.json({
        success: true,
        message: 'User flagged successfully'
      });
    } catch (error) {
      logger.error('Error flagging user', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to flag user'
      });
    }
  }

  async unflagUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminId = req.admin!.id;

      await this.adminService.unflagUser(userId, adminId);
      
      res.json({
        success: true,
        message: 'User unflagged successfully'
      });
    } catch (error) {
      logger.error('Error unflagging user', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to unflag user'
      });
    }
  }

  async investigateTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const analysis = await this.adminService.investigateBlockchainTransaction(transactionId);
      
      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Error investigating transaction', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to investigate transaction'
      });
    }
  }

  async enableMaintenanceMode(req: Request, res: Response): Promise<void> {
    try {
      const { message } = req.body;
      const adminId = req.admin!.id;

      // Check super admin permission
      if (!req.admin!.permissions.includes('system_maintenance')) {
        res.status(403).json({
          success: false,
          error: 'Super admin privileges required'
        });
        return;
      }

      await this.adminService.enableMaintenanceMode(adminId, message);
      
      res.json({
        success: true,
        message: 'Maintenance mode enabled'
      });
    } catch (error) {
      logger.error('Error enabling maintenance mode', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to enable maintenance mode'
      });
    }
  }

  async disableMaintenanceMode(req: Request, res: Response): Promise<void> {
    try {
      const adminId = req.admin!.id;

      // Check super admin permission
      if (!req.admin!.permissions.includes('system_maintenance')) {
        res.status(403).json({
          success: false,
          error: 'Super admin privileges required'
        });
        return;
      }

      await this.adminService.disableMaintenanceMode(adminId);
      
      res.json({
        success: true,
        message: 'Maintenance mode disabled'
      });
    } catch (error) {
      logger.error('Error disabling maintenance mode', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to disable maintenance mode'
      });
    }
  }
}