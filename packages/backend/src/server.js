const express = require("express");
const dotenv = require("dotenv");
const SocketIO = require('socket.io');
const { mysqlPool } = require("./config/mysql");
const { redisClient } = require("./config/redis");

const {createServer} = require("node:http");

dotenv.config();

const ws = new SocketIO.Server(createServer({
  port: process.env.WS_PORT || 4000,
}), {

});

const app = express();

app.get("/health", async (_req, res) => {
  const checks = {
    mysql: false,
    redis: false
  };

  try {
    const [rows] = await mysqlPool.query("SELECT 1 AS ok");
    checks.mysql = Array.isArray(rows);
  } catch (err) {
    console.error("MySQL health check failed:", err.message);
  }

  try {
    await redisClient.ping();
    checks.redis = true;
  } catch (err) {
    console.error("Redis health check failed:", err.message);
  }

  const ok = checks.mysql && checks.redis;
  res.status(ok ? 200 : 500).json({ ok, checks });
});

app.get("/", (_req, res) => {
  res.json({ message: "Backend is running." });
});

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

ws.on("connection", (socket) => {
  socket.emit("connected", { status: "hi there" });
})

process.on("SIGINT", async () => {
  await redisClient.quit();
  await mysqlPool.end();
  process.exit(0);
});
