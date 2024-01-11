import mysql from "mysql2/promise";

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  database: "tarefas_db",
  password: "admin123",
  port: 3306,
});

export default { db };
