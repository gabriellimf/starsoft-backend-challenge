import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class InitSchema20260201120000 implements MigrationInterface {
  name = 'InitSchema20260201120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'movieTitle', type: 'varchar', isNullable: false },
          { name: 'startTime', type: 'timestamptz', isNullable: false },
          { name: 'room', type: 'varchar', isNullable: false },
          { name: 'price', type: 'numeric', precision: 10, scale: 2, isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'seats',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'sessionId', type: 'uuid', isNullable: false },
          { name: 'code', type: 'varchar', isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'seats',
      new TableForeignKey({
        columnNames: ['sessionId'],
        referencedTableName: 'sessions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createUniqueConstraint(
      'seats',
      new TableUnique({ columnNames: ['sessionId', 'code'], name: 'UQ_seats_session_code' }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'reservations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'userId', type: 'varchar', isNullable: false },
          { name: 'sessionId', type: 'uuid', isNullable: false },
          { name: 'seatId', type: 'uuid', isNullable: false },
          { name: 'status', type: 'varchar', isNullable: false },
          { name: 'expiresAt', type: 'timestamptz', isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'reservations',
      new TableForeignKey({
        columnNames: ['sessionId'],
        referencedTableName: 'sessions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'reservations',
      new TableForeignKey({
        columnNames: ['seatId'],
        referencedTableName: 'seats',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'reservations',
      new TableIndex({ name: 'IDX_reservations_seat_status', columnNames: ['seatId', 'status'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'sales',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'userId', type: 'varchar', isNullable: false },
          { name: 'reservationId', type: 'uuid', isNullable: false },
          { name: 'sessionId', type: 'uuid', isNullable: false },
          { name: 'seatId', type: 'uuid', isNullable: false },
          { name: 'price', type: 'numeric', precision: 10, scale: 2, isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'sales',
      new TableForeignKey({
        columnNames: ['reservationId'],
        referencedTableName: 'reservations',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
      }),
    );

    await queryRunner.createForeignKey(
      'sales',
      new TableForeignKey({
        columnNames: ['sessionId'],
        referencedTableName: 'sessions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'sales',
      new TableForeignKey({
        columnNames: ['seatId'],
        referencedTableName: 'seats',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createUniqueConstraint(
      'sales',
      new TableUnique({ columnNames: ['seatId'], name: 'UQ_sales_seat' }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint('sales', 'UQ_sales_seat');
    const salesTable = await queryRunner.getTable('sales');
    for (const fk of salesTable?.foreignKeys || []) {
      await queryRunner.dropForeignKey('sales', fk);
    }
    await queryRunner.dropTable('sales');

    const reservationsTable = await queryRunner.getTable('reservations');
    for (const fk of reservationsTable?.foreignKeys || []) {
      await queryRunner.dropForeignKey('reservations', fk);
    }
    await queryRunner.dropIndex('reservations', 'IDX_reservations_seat_status');
    await queryRunner.dropTable('reservations');

    await queryRunner.dropUniqueConstraint('seats', 'UQ_seats_session_code');
    const seatsTable = await queryRunner.getTable('seats');
    for (const fk of seatsTable?.foreignKeys || []) {
      await queryRunner.dropForeignKey('seats', fk);
    }
    await queryRunner.dropTable('seats');

    await queryRunner.dropTable('sessions');
  }
}
