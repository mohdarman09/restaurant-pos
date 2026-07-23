import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

/** Verifies the Bearer access token and attaches the decoded payload to req.auth. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length);
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
}

/** Restricts a route to one or more roles. Use after `authenticate`. */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) throw ApiError.unauthorized();
    if (!roles.includes(req.auth.role)) {
      throw ApiError.forbidden(`Requires one of roles: ${roles.join(', ')}`);
    }
    next();
  };
}
