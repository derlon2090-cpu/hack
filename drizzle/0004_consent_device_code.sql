ALTER TABLE consents ADD COLUMN IF NOT EXISTS device_code text;
UPDATE consents
SET device_code = substring(policy_version from ';device=([0-9a-f-]{36})$')
WHERE device_code IS NULL AND policy_version ~ ';device=[0-9a-f-]{36}$';
UPDATE consents
SET policy_version = regexp_replace(policy_version, ';device=[0-9a-f-]{36}$', '')
WHERE policy_version ~ ';device=[0-9a-f-]{36}$';
