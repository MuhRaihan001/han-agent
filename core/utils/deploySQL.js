const mysql2 = require('mysql2/promise');

class Database {
    constructor() {
        this.connection = mysql2.createPool({
            host: process.env.DATABASE_HOST,
            user: process.env.DATABASE_USER, // fixed typo: DARABASE -> DATABASE
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    async execute(query, params) {
        const [rows] = await this.connection.execute(query, params);
        return rows;
    }

    // Now accepts a callback: async (conn) => { ... }
    async transaction(callback) {
        const connection = await this.connection.getConnection();
        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new Database();