import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1670000000000 implements MigrationInterface {
  name = 'InitialSchema1670000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id uuid PRIMARY KEY,
        movieTitle varchar NOT NULL,
        startTime timestamptz NOT NULL,
        room varchar NOT NULL,
        price numeric(10,2) NOT NULL,
        createdAt timestamptz DEFAULT now() NOT NULL,
        updatedAt timestamptz DEFAULT now() NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS seats (
        id uuid PRIMARY KEY,
        sessionId uuid NOT NULL,
        code varchar NOT NULL,
        createdAt timestamptz DEFAULT now() NOT NULL,
        updatedAt timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT fk_seats_session FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        CONSTRAINT uq_seats_session_code UNIQUE (sessionId, code)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id uuid PRIMARY KEY,
        userId varchar NOT NULL,
        sessionId uuid NOT NULL,
        seatId uuid NOT NULL,
        status varchar NOT NULL,
        expiresAt timestamptz NOT NULL,
        createdAt timestamptz DEFAULT now() NOT NULL,
        updatedAt timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT fk_reservations_session FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_reservations_seat FOREIGN KEY (seatId) REFERENCES seats(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_seat_status ON reservations (seatId, status);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id uuid PRIMARY KEY,
        userId varchar NOT NULL,
        reservationId uuid NOT NULL,
        sessionId uuid NOT NULL,
        seatId uuid NOT NULL,
        price numeric(10,2) NOT NULL,
        createdAt timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT fk_sales_reservation FOREIGN KEY (reservationId) REFERENCES reservations(id),
        CONSTRAINT fk_sales_session FOREIGN KEY (sessionId) REFERENCES sessions(id),
        CONSTRAINT fk_sales_seat FOREIGN KEY (seatId) REFERENCES seats(id),
        CONSTRAINT uq_sales_seat UNIQUE (seatId)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS sales;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reservations_seat_status;`);
    await queryRunner.query(`DROP TABLE IF EXISTS reservations;`);
    await queryRunner.query(`DROP TABLE IF EXISTS seats;`);
    await queryRunner.query(`DROP TABLE IF EXISTS sessions;`);
  }
}
