const mysql = require("mysql2/promise");

const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || "appuser",
  password: process.env.MYSQL_PASSWORD || "apppassword",
  database: process.env.MYSQL_DATABASE || "appdb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = { mysqlPool };
