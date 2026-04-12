const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("./config/db");

const app = express();
const publicPath = path.join(__dirname, "public");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Middleware
app.use(cors());
app.use(express.json());

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// User Managements
const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

// Department
const departmentRoutes = require("./routes/departmentRoutes");
app.use("/api/departments", departmentRoutes);

// Role
const roleRoutes = require("./routes/roleRoutes");
app.use("/api/roles", roleRoutes);

// Team
const teamRoutes = require("./routes/teamRoutes");
app.use("/api/teams", teamRoutes);

// Dropdowns
const dropdownRoute = require("./routes/dropdownRoute");
app.use("/api/dropdown", dropdownRoute);

// Reports
const reportRoutes = require("./routes/reportRoutes");
app.use("/api/reports", reportRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Test Case Manager API" });
});

app.use(express.static(publicPath, { index: false }));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found" });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    if (err) next(err);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
