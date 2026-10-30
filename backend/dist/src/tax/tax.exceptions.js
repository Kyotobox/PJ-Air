"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationException = void 0;
const common_1 = require("@nestjs/common");
class ValidationException extends common_1.BadRequestException {
    details;
    constructor(message, details) {
        super(message);
        this.name = 'ValidationException';
        this.details = details;
    }
}
exports.ValidationException = ValidationException;
//# sourceMappingURL=tax.exceptions.js.map