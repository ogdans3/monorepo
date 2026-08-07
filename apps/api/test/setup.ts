process.env.NODE_ENV = 'test';
process.env.RUN_REAPER = '0';
process.env.DATABASE_URL ??= 'postgres://checkpost:checkpost@localhost:5433/checkpost_test';
process.env.PUBLIC_WEB_ORIGIN ??= 'https://checkpost.test';
process.env.CORS_ORIGINS ??= '';

// Rate limits are production behaviour, not test behaviour: one suite makes
// hundreds of calls from one "IP". The limiter itself is covered explicitly in
// rate-limit.test.ts, which sets its own low ceiling.
process.env.RATE_LIMIT_MAX ??= '100000';
process.env.RATE_LIMIT_CREATE_MAX ??= '100000';
process.env.RATE_LIMIT_ROTATE_MAX ??= '100000';
