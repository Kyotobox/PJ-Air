"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCheckPaymentsTable1730200000000 = void 0;
class CreateCheckPaymentsTable1730200000000 {
    name = 'CreateCheckPaymentsTable1730200000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS check_payments (
        id VARCHAR PRIMARY KEY NOT NULL,
        order_id VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL,
        check_number VARCHAR NOT NULL,
        bank_name VARCHAR NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        received_date VARCHAR NOT NULL,
        clearance_deadline VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'PENDING_RECEIPT',
        notes TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
      );
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_check_payments_order_id ON check_payments(order_id);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_check_payments_user_id ON check_payments(user_id);
    `);
        const userCols = await queryRunner.query(`PRAGMA table_info(users);`);
        const userColNames = userCols.map((c) => c.name);
        if (!userColNames.includes('credit_blocked')) {
            await queryRunner.query(`ALTER TABLE users ADD COLUMN credit_blocked BOOLEAN DEFAULT 0;`);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS check_payments;`);
    }
}
exports.CreateCheckPaymentsTable1730200000000 = CreateCheckPaymentsTable1730200000000;
//# sourceMappingURL=1730200000000-CreateCheckPaymentsTable.js.map