import { BadRequestException } from '@nestjs/common';
export declare class ValidationException extends BadRequestException {
    readonly details: any;
    constructor(message: string, details?: any);
}
