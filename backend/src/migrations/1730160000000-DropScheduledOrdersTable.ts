import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropScheduledOrdersTable1730160000000 implements MigrationInterface {
  name = 'DropScheduledOrdersTable1730160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS scheduled_orders;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Scheduled orders has been permanently purged in Sprint S43
  }
}
