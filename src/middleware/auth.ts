import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Token payload structure
interface TokenPayload {
  id: string;
  username?: string;
  email?: string;
  user_type?: string;
}

// Extended request with user info from token
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username?: string;
    email?: string;
    user_type?: string;
  };
}

/**
 * Middleware to extract user info from JWT token (Authorization header)
 * Also supports reading user info from X-User-* headers set by API Gateway
 */
export const extractUser = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // First, try to get user info from X-User-* headers (set by API Gateway)
  const userIdHeader = req.headers['x-user-id'] as string;
  const usernameHeader = req.headers['x-user-username'] as string;
  const emailHeader = req.headers['x-user-email'] as string;
  const userTypeHeader = req.headers['x-user-type'] as string;

  if (userIdHeader) {
    req.user = {
      id: userIdHeader,
      username: usernameHeader,
      email: emailHeader,
      user_type: userTypeHeader,
    };
    return next();
  }

  // Fallback: Try to decode JWT token from Authorization header
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
      
      req.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        user_type: decoded.user_type,
      };
    } catch (error) {
      // Token invalid or expired - user remains undefined
      // Let downstream middleware handle auth requirements
    }
  }

  next();
};

/**
 * Middleware to require authentication
 */
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  next();
};

/**
 * Middleware to require specific user type(s)
 * @param allowedTypes - Array of allowed user types (e.g., ['creator'], ['creator', 'admin'])
 */
export const requireUserType = (allowedTypes: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userType = req.user.user_type;
    if (!userType || !allowedTypes.includes(userType)) {
      return res.status(403).json({ 
        success: false,
        message: `This action is only available for ${allowedTypes.join(' or ')} users`
      });
    }

    next();
  };
};

/**
 * Middleware to require admin access
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const userType = req.user.user_type;
  if (!userType || !['admin', 'super_admin'].includes(userType)) {
    return res.status(403).json({ 
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};
