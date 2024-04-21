
UPDATE companies SET
	updated_at = iif(like('%-%', updated_at), updated_at, datetime (updated_at / 1000, 'unixepoch')),
	created_at = iif(like('%-%', created_at), created_at, datetime (created_at / 1000, 'unixepoch'));

UPDATE company_users SET
	updated_at = iif(like('%-%', updated_at), updated_at, datetime (updated_at / 1000, 'unixepoch')),
	created_at = iif(like('%-%', created_at), created_at, datetime (created_at / 1000, 'unixepoch'));

UPDATE export_settings SET
	updated_at = iif(like('%-%', updated_at), updated_at, datetime (updated_at / 1000, 'unixepoch')),
	created_at = iif(like('%-%', created_at), created_at, datetime (created_at / 1000, 'unixepoch'));

UPDATE repositories SET
	updated_at = iif(like('%-%', updated_at), updated_at, datetime (updated_at / 1000, 'unixepoch')),
	created_at = iif(like('%-%', created_at), created_at, datetime (created_at / 1000, 'unixepoch'));

UPDATE team_repositories SET
	updated_at = iif(like('%-%', updated_at), updated_at, datetime (updated_at / 1000, 'unixepoch')),
	created_at = iif(like('%-%', created_at), created_at, datetime (created_at / 1000, 'unixepoch'));

UPDATE team_users SET
	updated_at = iif(like('%-%', updated_at), updated_at, datetime (updated_at / 1000, 'unixepoch')),
	created_at = iif(like('%-%', created_at), created_at, datetime (created_at / 1000, 'unixepoch'));

UPDATE teams SET
	updated_at = iif(like('%-%', updated_at), updated_at, datetime (updated_at / 1000, 'unixepoch')),
	created_at = iif(like('%-%', created_at), created_at, datetime (created_at / 1000, 'unixepoch'));

UPDATE users SET
	updated_at = iif(like('%-%', updated_at), updated_at, datetime (updated_at / 1000, 'unixepoch')),
	created_at = iif(like('%-%', created_at), created_at, datetime (created_at / 1000, 'unixepoch'));

UPDATE pull_requests SET
	first_committed_at = strftime('%Y-%m-%d %H:%M:%S', first_committed_at),
	pull_request_created_at = strftime('%Y-%m-%d %H:%M:%S', pull_request_created_at),
	first_reviewed_at = strftime('%Y-%m-%d %H:%M:%S', first_reviewed_at),
	merged_at = strftime('%Y-%m-%d %H:%M:%S', merged_at),
	released_at = strftime('%Y-%m-%d %H:%M:%S', released_at),
	updated_at = strftime('%Y-%m-%d %H:%M:%S', updated_at);
