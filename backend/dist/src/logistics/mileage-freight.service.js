"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MileageFreightService = exports.ASTORIA_ORIGIN = void 0;
const common_1 = require("@nestjs/common");
exports.ASTORIA_ORIGIN = {
    address: '3304 Broadway, Astoria, NY 11106',
    lat: 40.761032,
    lng: -73.923714,
    zip: '11106',
};
let MileageFreightService = class MileageFreightService {
    origin = exports.ASTORIA_ORIGIN;
    calculateDistanceMiles(destLat, destLng, applyRoadFactor = true) {
        if (destLat === null || destLat === undefined || typeof destLat !== 'number' || isNaN(destLat)) {
            throw new common_1.BadRequestException('Latitud de destino inválida');
        }
        if (destLng === null || destLng === undefined || typeof destLng !== 'number' || isNaN(destLng)) {
            throw new common_1.BadRequestException('Longitud de destino inválida');
        }
        if (destLat < -90 || destLat > 90) {
            throw new common_1.BadRequestException('Latitud de destino fuera de rango (-90 a 90)');
        }
        if (destLng < -180 || destLng > 180) {
            throw new common_1.BadRequestException('Longitud de destino fuera de rango (-180 a 180)');
        }
        const R = 3958.8;
        const dLat = ((destLat - this.origin.lat) * Math.PI) / 180;
        const dLon = ((destLng - this.origin.lng) * Math.PI) / 180;
        const lat1 = (this.origin.lat * Math.PI) / 180;
        const lat2 = (destLat * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const straightLine = R * c;
        const factor = applyRoadFactor ? 1.25 : 1.0;
        const computedMiles = Math.round((straightLine * factor + Number.EPSILON) * 10) / 10;
        return computedMiles;
    }
    calculateFreight(miles, serviceType = 'shared') {
        if (miles === null || miles === undefined || typeof miles !== 'number' || isNaN(miles)) {
            throw new common_1.BadRequestException('La distancia en millas debe ser un número válido');
        }
        if (miles < 0) {
            throw new common_1.BadRequestException('La distancia en millas no puede ser negativa');
        }
        const type = (serviceType || 'shared').toLowerCase();
        if (!['shared', 'exclusive', 'pickup'].includes(type)) {
            throw new common_1.BadRequestException(`Tipo de servicio de flete desconocido: ${serviceType}`);
        }
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
            }
            else if (miles <= 20) {
                cost = 60;
            }
            else if (miles <= 30) {
                cost = 80;
            }
            else if (miles <= 40) {
                cost = 100;
            }
            else if (miles <= 50) {
                cost = 125;
            }
            else {
                const extraBrackets = Math.ceil((miles - 50) / 10);
                cost = 125 + extraBrackets * 25;
            }
        }
        else if (type === 'exclusive') {
            if (miles <= 10) {
                cost = 200;
            }
            else if (miles <= 20) {
                cost = 225;
            }
            else if (miles <= 30) {
                cost = 250;
            }
            else if (miles <= 40) {
                cost = 275;
            }
            else if (miles <= 50) {
                cost = 300;
            }
            else {
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
    quoteByCoordinates(destLat, destLng, serviceType = 'shared', destinationAddress) {
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
};
exports.MileageFreightService = MileageFreightService;
exports.MileageFreightService = MileageFreightService = __decorate([
    (0, common_1.Injectable)()
], MileageFreightService);
//# sourceMappingURL=mileage-freight.service.js.map