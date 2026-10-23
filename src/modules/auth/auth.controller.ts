import { Request, Response } from 'express';
import { authService, AuthService } from './auth.service';
import { ApiResponseSuccess, AppError } from '../../errors/app-error';
import { AuthResponseData, AuthUserDto } from './auth.types';

export class AuthController {
  private service: AuthService;

  constructor(service: AuthService = authService) {
    this.service = service;
  }

  signup = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.signup(req.body);

    const response: ApiResponseSuccess<AuthResponseData> = {
      success: true,
      data: result,
    };

    res.status(201).json(response);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.login(req.body);

    const response: ApiResponseSuccess<AuthResponseData> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const response: ApiResponseSuccess<{ user: AuthUserDto }> = {
      success: true,
      data: {
        user: req.user,
      },
    };

    res.status(200).json(response);
  };
}

export const authController = new AuthController();
