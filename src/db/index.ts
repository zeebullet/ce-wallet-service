import knex from 'knex';
import { config } from '../config';

const db = knex({
  client: 'pg',
  connection: config.database.url || {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  },
  pool: { min: 2, max: 10 },
});

export default db;
