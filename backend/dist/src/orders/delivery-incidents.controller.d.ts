import { DeliveryIncidentsService } from './delivery-incidents.service';
import { CreateDeliveryIncidentDto } from './dto/create-delivery-incident.dto';
export declare class DeliveryIncidentsController {
    private readonly deliveryIncidentsService;
    constructor(deliveryIncidentsService: DeliveryIncidentsService);
    reportIncident(orderId: string, body: CreateDeliveryIncidentDto, req: any): Promise<import("./delivery-incident.entity").DeliveryIncident>;
    approveIncident(incidentId: string, req: any): Promise<import("./delivery-incident.entity").DeliveryIncident>;
    getIncidentsByUser(userId: string): Promise<import("./delivery-incident.entity").DeliveryIncident[]>;
    getIncidentsByOrder(orderId: string, req: any): Promise<import("./delivery-incident.entity").DeliveryIncident[]>;
}
