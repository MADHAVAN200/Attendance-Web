import knex from 'knex';
import './config.js';

const DB_HOST = process.env.DB_HOST;
const DB_PORT = Number(process.env.DB_PORT) || 3306;

//admin access only for local dev environment
export let adminDB = null;

if (process.env.NODE_ENV === 'development') {
  adminDB = knex({
    client: 'mysql2',
    connection: {
      host: DB_HOST,
      port: DB_PORT,
      user: process.env.DB_ADMIN_USER,
      password: process.env.DB_ADMIN_PASSWORD,
      database: process.env.DB_ADMIN_NAME,
    },
  });
}

export const attendanceDB = knex({
  client: 'mysql2',
  connection: {
    host: DB_HOST,
    port: DB_PORT,
    user: process.env.ATTENDANCE_DB_USER,
    password: process.env.ATTENDANCE_DB_PASSWORD,
    database: process.env.ATTENDANCE_DB_NAME,
  },
  pool: { min: 0, max: 10 },
});

export const paymentDB = knex({
  client: 'mysql2',
  connection: {
    host: DB_HOST,
    port: DB_PORT,
    user: process.env.PAYMENT_DB_USER,
    password: process.env.PAYMENT_DB_PASSWORD,
    database: process.env.PAYMENT_DB_NAME,
  },
  pool: { min: 0, max: 5 },
});