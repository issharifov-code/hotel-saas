import { MigrationInterface, QueryRunner } from 'typeorm';

// Channel Manager — mehmonxonaning OTA (Booking.com, Airbnb va h.k.)
// kanallariga ulanishi (`channels`), har bir kanal ichida xona turi/narx
// rejasi xaritalashi (`channel_room_type_mappings`), va har bir sinxronlash
// urinishi uchun audit jurnali (`channel_sync_logs`). Haqiqiy OTA API hali
// ulanmagan — ChannelManagerService MockChannelAdapter orqali simulyatsiya
// qiladi (Payments/Messaging modullaridagi adapter naqshi).
export class AddChannelManager1787500000000 implements MigrationInterface {
  name = 'AddChannelManager1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "channels_provider_enum" AS ENUM ('booking_com', 'airbnb', 'agoda', 'expedia', 'other')
    `);
    await queryRunner.query(`
      CREATE TYPE "channel_sync_logs_status_enum" AS ENUM ('success', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "channels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "provider" "channels_provider_enum" NOT NULL,
        "external_property_id" character varying(100),
        "is_active" boolean NOT NULL DEFAULT true,
        "last_synced_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channels" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_channels_tenant_property" ON "channels" ("tenant_id", "property_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "channel_room_type_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "rate_plan_id" uuid,
        "external_room_type_id" character varying(100),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_room_type_mappings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_channel_room_type_mappings_channel_id" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_channel_room_type_mappings_channel_room_type" ON "channel_room_type_mappings" ("channel_id", "room_type_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "channel_sync_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel_id" uuid NOT NULL,
        "synced_at" TIMESTAMP NOT NULL,
        "status" "channel_sync_logs_status_enum" NOT NULL,
        "room_types_synced" integer NOT NULL,
        "days_synced" integer NOT NULL,
        "summary" character varying(1000) NOT NULL,
        "provider_ref" character varying(200),
        "failure_reason" character varying(500),
        CONSTRAINT "PK_channel_sync_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_channel_sync_logs_channel_id" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_channel_sync_logs_channel_id" ON "channel_sync_logs" ("channel_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_channel_sync_logs_channel_id"`,
    );
    await queryRunner.query(`DROP TABLE "channel_sync_logs"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_channel_room_type_mappings_channel_room_type"`,
    );
    await queryRunner.query(`DROP TABLE "channel_room_type_mappings"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_channels_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "channels"`);

    await queryRunner.query(`DROP TYPE "channel_sync_logs_status_enum"`);
    await queryRunner.query(`DROP TYPE "channels_provider_enum"`);
  }
}
