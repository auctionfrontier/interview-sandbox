const express = require("express");
const dotenv = require("dotenv");
const { createServer } = require("node:http");
const { Server: SocketIOServer } = require("socket.io");
const { mysqlPool } = require("./config/mysql");
const { redisClient } = require("./config/redis");
const { createAuctionEngine } = require("./auctionEngine");
const { MockAuctionStore } = require("./mockAuctionStore");
const { startBidStreamSimulator } = require("./bidStreamSimulator");

dotenv.config();

const app = express();
app.use(express.json());

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

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*"
  }
});

const store = new MockAuctionStore();
const engine = createAuctionEngine(store);

const broadcastEvents = (events) => {
  if (!events || events.length === 0) return;
  events.forEach((event) => io.emit("auction:event", event));
};

const handleBid = (bid) => {
  try {
    const events = engine.applyBid(bid);
    broadcastEvents(events);
  } catch (error) {
    io.emit("auction:event", {
      type: "ERROR",
      payload: {
        message: error.message,
        bid
      },
      timestamp: Date.now()
    });
  }
};

io.on("connection", (socket) => {
  socket.emit("auction:snapshot", engine.getSnapshot());

  socket.on("bid:place", (payload) => {
    const bid = {
      ...payload,
      id: `user-${Date.now()}`,
      timestamp: Date.now()
    };
    handleBid(bid);
  });
});

startBidStreamSimulator({
  engine,
  onEvents: broadcastEvents
});

const port = Number(process.env.PORT) || 3000;
httpServer.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

process.on("SIGINT", async () => {
  await redisClient.quit();
  await mysqlPool.end();
  process.exit(0);
});
