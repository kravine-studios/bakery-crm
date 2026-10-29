import { Role } from '../types/enums';

// Augment Express Request with the authenticated user payload
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: Role;
        displayName: string;
      };
    }
  }
}
