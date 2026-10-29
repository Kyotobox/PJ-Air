import { Injectable, BadRequestException } from '@nestjs/common';

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
  zip?: string;
}

export const ASTORIA_ORIGIN: LocationPoint = {
  address: '3304 Broadway, Astoria, NY 11106',
  lat: 40.761032,
  lng: -73.923714,
  zip: '11106',
};

export type DeliveryServiceType = 'shared' | 'exclusive' | 'pickup';

export interface FreightQuoteResult {
  origin: LocationPoint;
  destination?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  serviceType: DeliveryServiceType;
  miles: number;
  cost: number;
  requiresSpecialQuote: boolean;
  notes?: string;
}

@Injectable()
export class MileageFreightService {
  readonly origin = ASTORIA_ORIGIN;

  /**
   * Calcula la distancia en millas (Haversine + factor de ruta vial comercial 1.25x)
   * desde 3304 Broadway, Astoria, NY 11106 hasta las coordenadas de destino.
   */
  calculateDistanceMiles(destLat: number, destLng: number, applyRoadFactor = true): number {
    if (destLat === null || destLat === undefined || typeof destLat !== 'number' || isNaN(destLat)) {
      throw new BadRequestException('Latitud de destino inválida');
    }
    if (destLng === null || destLng === undefined || typeof destLng !== 'number' || isNaN(destLng)) {
      throw new BadRequestException('Longitud de destino inválida');
    }

    if (destLat < -90 || destLat > 90) {
      throw new BadRequestException('Latitud de destino fuera de rango (-90 a 90)');
    }
    if (destLng < -180 || destLng > 180) {
      throw new BadRequestException('Longitud de destino fuera de rango (-180 a 180)');
    }

    const R = 3958.8; // Radio de la Tierra en millas
    const dLat = ((destLat - this.origin.lat) * Math.PI) / 180;
    const dLon = ((destLng - this.origin.lng) * Math.PI) / 180;
    const lat1 = (this.origin.lat * Math.PI) / 180;
    const lat2 = (destLat * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightLine = R * c;

    // Multiplicador de trazado vial comercial de van (1.25x para tráfico y curvas metropolitanas)
    const factor = applyRoadFactor ? 1.25 : 1.0;
    const computedMiles = Math.round((straightLine * factor + Number.EPSILON) * 10) / 10;
    return computedMiles;
  }

  /**
   * Calcula la tarifa de flete comercial en base a la matriz oficial:
   * 
   * Retiro en Tienda (Pickup): $0.00
   * 
   * Ruta Compartida:
   *   0 - 10 mi: $40
   *  11 - 20 mi: $60
   *  21 - 30 mi: $80
   *  31 - 40 mi: $100
   *  41 - 50 mi: $125
   *  51 - 250 mi: $125 + cada bloque adicional de 10 mi a $25
   * 
   * Salida Exclusiva:
   *   0 - 10 mi: $200
   *  11 - 20 mi: $225
   *  21 - 30 mi: $250
   *  31 - 40 mi: $275
   *  41 - 50 mi: $300
   *  51 - 250 mi: $300 + cada bloque adicional de 10 mi a $25
   * 
   * > 250 millas:
   *   Cotización especial de ruta (requiresSpecialQuote = true, cost = 0)
   */
  calculateFreight(
    miles: number,
    serviceType: DeliveryServiceType = 'shared',
  ): FreightQuoteResult {
    if (miles === null || miles === undefined || typeof miles !== 'number' || isNaN(miles)) {
      throw new BadRequestException('La distancia en millas debe ser un número válido');
    }

    if (miles < 0) {
      throw new BadRequestException('La distancia en millas no puede ser negativa');
    }

    const type = (serviceType || 'shared').toLowerCase() as DeliveryServiceType;
    if (!['shared', 'exclusive', 'pickup'].includes(type)) {
      throw new BadRequestException(`Tipo de servicio de flete desconocido: ${serviceType}`);
    }

    // 1. Pickup en Astoria: siempre $0.00
    if (type === 'pickup') {
      return {
        origin: this.origin,
        serviceType: 'pickup',
        miles,
        cost: 0,
        requiresSpecialQuote: false,
        notes: 'Retiro en almacén Astoria, NY (Sin cargo de flete)',
      };
    }

    // 2. Distancia superior a 250 millas: cotización especial
    if (miles > 250) {
      return {
        origin: this.origin,
        serviceType: type,
        miles,
        cost: 0,
        requiresSpecialQuote: true,
        notes: 'Distancia superior a 250 millas: requiere cotización especial de ruta personalizada.',
      };
    }

    let cost = 0;

    if (type === 'shared') {
      if (miles <= 10) {
        cost = 40;
      } else if (miles <= 20) {
        cost = 60;
      } else if (miles <= 30) {
        cost = 80;
      } else if (miles <= 40) {
        cost = 100;
      } else if (miles <= 50) {
        cost = 125;
      } else {
        const extraBrackets = Math.ceil((miles - 50) / 10);
        cost = 125 + extraBrackets * 25;
      }
    } else if (type === 'exclusive') {
      if (miles <= 10) {
        cost = 200;
      } else if (miles <= 20) {
        cost = 225;
      } else if (miles <= 30) {
        cost = 250;
      } else if (miles <= 40) {
        cost = 275;
      } else if (miles <= 50) {
        cost = 300;
      } else {
        const extraBrackets = Math.ceil((miles - 50) / 10);
        cost = 300 + extraBrackets * 25;
      }
    }

    return {
      origin: this.origin,
      serviceType: type,
      miles,
      cost,
      requiresSpecialQuote: false,
      notes: `Flete de van comercial desde Astoria (${type === 'shared' ? 'Ruta Compartida' : 'Salida Exclusiva'})`,
    };
  }

  /**
   * Cotización completa recibiendo coordenadas de destino
   */
  quoteByCoordinates(
    destLat: number,
    destLng: number,
    serviceType: DeliveryServiceType = 'shared',
    destinationAddress?: string,
  ): FreightQuoteResult {
    const miles = this.calculateDistanceMiles(destLat, destLng);
    const quote = this.calculateFreight(miles, serviceType);
    return {
      ...quote,
      destination: {
        lat: destLat,
        lng: destLng,
        address: destinationAddress,
      },
    };
  }
}
