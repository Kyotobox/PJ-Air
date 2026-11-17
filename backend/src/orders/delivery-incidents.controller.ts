import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DeliveryIncidentsService } from './delivery-incidents.service';
import { CreateDeliveryIncidentDto } from './dto/create-delivery-incident.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('orders')
export class DeliveryIncidentsController {
  constructor(private readonly deliveryIncidentsService: DeliveryIncidentsService) {}

  /**
   * POST /orders/:id/incidents
   * Permite al cliente (dueño de la orden) o admin reportar una incidencia.
   */
  @Post(':id/incidents')
  @UseGuards(AuthGuard)
  async reportIncident(
    @Param('id') orderId: string,
    @Body() body: CreateDeliveryIncidentDto,
    @Req() req: any,
  ) {
    return this.deliveryIncidentsService.createIncident(
      {
        ...body,
        order_id: orderId,
      },
      req.user,
    );
  }

  /**
   * PATCH /orders/incidents/:id/approve
   * Solo rol 'admin'. Aprueba y acredita el saldo a favor.
   */
  @Patch('incidents/:id/approve')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async approveIncident(
    @Param('id') incidentId: string,
    @Req() req: any,
  ) {
    const adminId = req.user?.id || 'admin';
    return this.deliveryIncidentsService.approveIncident(incidentId, adminId);
  }

  /**
   * GET /orders/incidents/user/:userId
   * Consulta el historial de incidencias de un cliente.
   */
  @Get('incidents/user/:userId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async getIncidentsByUser(
    @Param('userId') userId: string,
  ) {
    return this.deliveryIncidentsService.findByUser(userId);
  }

  /**
   * GET /orders/:id/incidents
   * Consulta las incidencias de una orden.
   */
  @Get(':id/incidents')
  @UseGuards(AuthGuard)
  async getIncidentsByOrder(
    @Param('id') orderId: string,
    @Req() req: any,
  ) {
    return this.deliveryIncidentsService.findByOrder(orderId, req.user);
  }
}
