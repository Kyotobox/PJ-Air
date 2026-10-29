import { BadRequestException } from '@nestjs/common';

export class ValidationException extends BadRequestException {
  public readonly details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationException';
    this.details = details;
  }
}
