require('dotenv').config();
const mysql = require('mysql2/promise');

async function connectDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DATABASE_HOST,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE,
        port: process.env.DATABASE_PORT
    });

    return connection;
}

module.exports = connectDatabase;