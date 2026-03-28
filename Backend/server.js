const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("./config/db");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Test Case Manager API Running...");
});

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Login Auth
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// User Managements
const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

// Department
const departmentRoutes = require("./routes/departmentRoutes");
app.use("/api/departments", departmentRoutes);