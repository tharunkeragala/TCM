const sql = require("mssql");

const config = {
  user: "app_user",
  password: "password123",
  server: "localhost",
  port: 1433,
  database: "test_case_manager",
  options: {
    trustServerCertificate: true,
    encrypt: false
  }
};

const poolPromise = sql.connect(config)
  .then(pool => {
    console.log("SQL Server Connected");
    return pool;
  })
  .catch(err => {
    console.error("Database connection failed:", err);
  });

module.exports = {
  sql,
  poolPromise
};