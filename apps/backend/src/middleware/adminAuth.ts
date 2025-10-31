import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SwapPlatformError } from '@booking-swap/shared';

interface AdminUser {
  id: string;
  walletAddress: string;
  role: 'admin' | 'super_admin';
  permissions: string[];
}

// Admin wallet addresses - in production, this would be in a secure config
const ADMIN_WALLETS = new Set([
  '0.0.123456', // Example admin wallet
  '0.0.789012', // Example super admin wallet
]);

const ADMIN_PERMISSIONS = {
  admin: [
    'view_statistics',
    'view_disputes',
    'resolve_disputes',
    'flag_users',
    'view_transactions'
  ],
  super_admin: [
    'view_statistics',
    'view_disputes',
    'resolve_disputes',
    'flag_users',
    'view_transactions',
    'system_maintenance',
    'manage_admins'
  ]
};

export const adminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new SwapPlatformError(
        'ADMIN_AUTH_MISSING_TOKEN',
        'Admin access token required',
        'validation'
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Check if wallet address is in admin list
    if (!ADMIN_WALLETS.has(decoded.walletAddress)) {
      throw new SwapPlatformError(
        'ADMIN_AUTH_INSUFFICIENT_PRIVILEGES',
        'Admin privileges required',
        'validation'
      );
    }

    // Determine admin role based on wallet
    const role = decoded.walletAddress === '0.0.789012' ? 'super_admin' : 'admin';
    
    const adminUser: AdminUser = {
      id: decoded.userId,
      walletAddress: decoded.walletAddress,
      role,
      permissions: ADMIN_PERMISSIONS[role]
    };

    req.admin = adminUser;
    next();
  } catch (error) {
    if (error instanceof SwapPlatformError) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(401).json({ error: 'Invalid admin token' });
    }
  }
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin?.permissions.includes(permission)) {
      res.status(403).json({ 
        error: `Permission required: ${permission}` 
      });
      return;
    }
    next();
  };
};

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      admin?: AdminUser;
    }
  }
}