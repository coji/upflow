-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_organization_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "release_detection_method" TEXT NOT NULL DEFAULT 'branch',
    "release_detection_key" TEXT NOT NULL DEFAULT 'production',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "excluded_users" TEXT NOT NULL DEFAULT '',
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_organization_settings" ("created_at", "id", "is_active", "organization_id", "release_detection_key", "release_detection_method", "updated_at") SELECT "created_at", "id", "is_active", "organization_id", "release_detection_key", "release_detection_method", "updated_at" FROM "organization_settings";
DROP TABLE "organization_settings";
ALTER TABLE "new_organization_settings" RENAME TO "organization_settings";
CREATE UNIQUE INDEX "organization_settings_organization_id_key" ON "organization_settings"("organization_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
