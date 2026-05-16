const sql = require("mssql");


// Sirinis PC
const config = {
  user: "app_user",
  password: "password123",
  server: "DESKTOP-29RLJ8O",
  database: "test_case_manager",
  options: {
    instanceName: "SQLEXPRESS",
    encrypt: true,
    trustServerCertificate: true
  }
};

// Home PC
// const config = {
//   user: "app_user",
//   password: "password123",
//   server: "DESKTOP-NF8MTUG",
//   database: "test_case_manager",
//   options: {
//     instanceName: "SQLEXPRESS02",
//     encrypt: true,
//     trustServerCertificate: true
//   }
// };

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