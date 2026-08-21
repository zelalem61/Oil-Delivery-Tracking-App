-- Preserve active trips by moving obsolete border stages back to IN_TRANSIT.
-- The enum values remain for historical audit records but cannot be selected by clients.
UPDATE "Delivery"
SET "status" = 'IN_TRANSIT', "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" IN ('BORDER_CHECK', 'CLEARED_BORDER');
