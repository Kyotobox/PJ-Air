import { Controller, Post, Get, Body, BadRequestException } from '@nestjs/common';
import { MileageFreightService, DeliveryServiceType } from './mileage-freight.service';

export class FreightQuoteDto {
  miles?: number;
  destLat?: number;
  destLng?: number;
  serviceType?: DeliveryServiceType;
  destinationAddress?: string;
}

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly freightService: MileageFreightService) {}

  @Get('origin')
  getOrigin() {
    return this.freightService.origin;
  }

  @Post('quote')
  calculateQuote(@Body() body: any) {
    const serviceType = body.serviceType || 'shared';

    if (body.destLat !== undefined && body.destLng !== undefined) {
      return this.freightService.quoteByCoordinates(
        Number(body.destLat),
        Number(body.destLng),
        serviceType,
        body.destinationAddress,
      );
    }

    if (body.miles !== undefined) {
      return this.freightService.calculateFreight(Number(body.miles), serviceType);
    }

    if (serviceType === 'pickup') {
      return this.freightService.calculateFreight(0, 'pickup');
    }

    throw new BadRequestException('Debe proporcionar "miles" o ("destLat" y "destLng") para cotizar');
  }
}
