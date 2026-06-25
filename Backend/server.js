// const path = require("path");
// const express = require("express");
// const cors = require("cors");
// require("dotenv").config();
// require("./config/db");

// const app = express();
// const publicPath = path.join(__dirname, "public");

// const cron = require("node-cron");
// const { processReminders } = require("./controllers/reminderProcessor");

// // Run every hour
// cron.schedule("0 * * * *", () => {
//   processReminders();
// });

// if (process.env.NODE_ENV === "production") {
//   app.set("trust proxy", 1);
// }

// // Middleware
// app.use(cors());
// app.use(express.json());

// const authRoutes = require("./routes/authRoutes");
// app.use("/api/auth", authRoutes);

// // User Managements
// const userRoutes = require("./routes/userRoutes");
// app.use("/api/users", userRoutes);

// // Task Management
// app.use("/api/tasks", require("./routes/taskRoutes"));

// // Department
// const departmentRoutes = require("./routes/departmentRoutes");
// app.use("/api/departments", departmentRoutes);

// // Role
// const roleRoutes = require("./routes/roleRoutes");
// app.use("/api/roles", roleRoutes);

// // Team
// const teamRoutes = require("./routes/teamRoutes");
// app.use("/api/teams", teamRoutes);

// // Project
// // const projectRoutes = require("./routes/projectRoutes");
// // app.use("/api/projects", projectRoutes);

// app.use("/api/projects",    require("./routes/projectRoutes"));
// app.use("/api/test-suites", require("./routes/testSuiteRoutes"));
// app.use("/api/test-cases",  require("./routes/testCaseRoutes"));

// // Dropdowns
// const dropdownRoute = require("./routes/dropdownRoute");
// app.use("/api/dropdown", dropdownRoute);

// // Reports
// const reportRoutes = require("./routes/reportRoutes");
// app.use("/api/reports", reportRoutes);

// app.get("/api/health", (req, res) => {
//   res.json({ status: "ok", service: "Test Case Manager API" });
// });

// app.use(express.static(publicPath, { index: false }));

// app.use((req, res, next) => {
//   if (req.path.startsWith("/api")) {
//     return res.status(404).json({ error: "Not found" });
//   }
//   if (req.method !== "GET" && req.method !== "HEAD") {
//     return next();
//   }
//   res.sendFile(path.join(publicPath, "index.html"), (err) => {
//     if (err) next(err);
//   });
// });

// const PORT = process.env.PORT || 3000;

// app.listen(PORT, "0.0.0.0", () => {
//   console.log(`Server running on port ${PORT}`);
// });
const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
require("dotenv").config();
require("./config/db");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const { attachWebSocketServer } = require("./services/wsHub");
attachWebSocketServer(wss);

const cron = require("node-cron");
const { processReminders } = require("./controllers/reminderProcessor");

cron.schedule("0 * * * *", () => {
  processReminders();
});

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/screenshots", express.static(path.join(__dirname, "screenshots")));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/departments", require("./routes/departmentRoutes"));
app.use("/api/roles", require("./routes/roleRoutes"));
app.use("/api/teams", require("./routes/teamRoutes"));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/test-suites", require("./routes/testSuiteRoutes"));
app.use("/api/test-cases", require("./routes/testCaseRoutes"));
app.use("/api/playwright", require("./routes/playwrightRoutes"));
app.use("/api/dropdown", require("./routes/dropdownRoute"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/sprints", require("./routes/sprintRoutes"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Test Case Manager API" });
});

// 404 for any unmatched route
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Playwright WebSocket server ready");
});