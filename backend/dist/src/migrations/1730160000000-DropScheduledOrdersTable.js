"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropScheduledOrdersTable1730160000000 = void 0;
class DropScheduledOrdersTable1730160000000 {
    name = 'DropScheduledOrdersTable1730160000000';
    async up(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS scheduled_orders;`);
    }
    async down(queryRunner) {
    }
}
exports.DropScheduledOrdersTable1730160000000 = DropScheduledOrdersTable1730160000000;
//# sourceMappingURL=1730160000000-DropScheduledOrdersTable.js.map