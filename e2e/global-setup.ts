import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

const authStatePath = path.resolve('e2e/.auth/seeded-user.json');

export default async function globalSetup() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required for authenticated browser tests.',
    );
  }

  const userId = randomUUID();
  const email = `playwright-m3-${randomUUID()}@example.test`;
  const sessionToken = randomUUID();
  const groceriesId = randomUUID();
  const restaurantsId = randomUUID();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const client = new Client({ connectionString });

  await client.connect();
  await client.query(
    'INSERT INTO "users" ("id", "email", "updated_at") VALUES ($1, $2, CURRENT_TIMESTAMP)',
    [userId, email],
  );
  await client.query(
    `INSERT INTO "categories" ("id", "user_id", "name", "normalized_name", "updated_at")
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP), ($5, $2, $6, $7, CURRENT_TIMESTAMP)`,
    [
      groceriesId,
      userId,
      'Groceries',
      'groceries',
      restaurantsId,
      'Restaurants',
      'restaurants',
    ],
  );
  await client.query(
    `INSERT INTO "transactions" (
      "id", "user_id", "category_id", "transaction_date", "type", "amount_cents", "description", "updated_at"
    )
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP),
      ($8, $2, $3, $9, $10, $11, $12, CURRENT_TIMESTAMP)`,
    [
      randomUUID(),
      userId,
      groceriesId,
      '2026-08-24',
      'expense',
      8_416,
      'Dashboard groceries',
      randomUUID(),
      '2026-08-19',
      'refund',
      1_264,
      'Dashboard refund',
    ],
  );
  await client.query(
    'INSERT INTO "sessions" ("session_token", "user_id", "expires") VALUES ($1, $2, $3)',
    [sessionToken, userId, expires],
  );
  await client.end();

  await mkdir(path.dirname(authStatePath), { recursive: true });
  await writeFile(
    authStatePath,
    JSON.stringify({
      cookies: [
        {
          domain: 'localhost',
          expires: Math.floor(expires.getTime() / 1000),
          httpOnly: true,
          name: 'next-auth.session-token',
          path: '/',
          sameSite: 'Lax',
          secure: false,
          value: sessionToken,
        },
      ],
      origins: [],
    }),
  );

  return async () => {
    const cleanupClient = new Client({ connectionString });

    await cleanupClient.connect();
    await cleanupClient
      .query('DELETE FROM "users" WHERE "id" = $1', [userId])
      .catch(() => undefined);
    await cleanupClient.end();
    await rm(authStatePath, { force: true });
  };
}
