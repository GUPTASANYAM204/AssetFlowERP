import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    departmentId: string | null;
  };
}

const secret = process.env.JWT_SECRET || 'production-secret-assetflow-token-signature-key-2026';

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authentication token format must be Bearer <token>' });
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      role: string;
      departmentId: string | null;
    };
    req.user = decoded;
    next();
  } catch (error) {
    console.error('[JWT Auth Error]', error);
    return res.status(401).json({ message: 'Invalid or expired authentication token' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: Access requires one of the following roles: [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
}
