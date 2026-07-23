import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

type Segment = 'body' | 'query' | 'params';

/** Validates req[segment] against a Zod schema, replacing it with the parsed value. */
export function validate(schema: ZodSchema, segment: Segment = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[segment]);
    if (!result.success) {
      throw ApiError.badRequest('Validation failed', result.error.flatten());
    }
    req[segment] = result.data;
    next();
  };
}
