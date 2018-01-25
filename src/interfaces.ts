import { User } from './entities/user';

export interface AuthenticatedRequest {
  app: {
    locals: {
      token: string;
      user?: User;
    }
  };
}
