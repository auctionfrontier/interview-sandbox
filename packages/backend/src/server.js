const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createServer } = require("node:http");
const { Server: SocketIOServer } = require("socket.io");
// const { mysqlPool } = require("./config/mysql");
// const { redisClient } = require("./config/redis");
const { createAuctionEngine } = require("./auctionEngine");
const { MockAuctionStore } = require("./mockAuctionStore");

dotenv.config();

const EVENT_DELAY_RANGE_MS = [40, 260];
const VEHICLE_ADVANCE_DELAY_MS = 5000;
const randomBetween = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Express API and Socket.IO share the same HTTP server instance.
const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// uncomment this if redis / mysql is available
// app.get("/health", async (_req, res) => {
//   const checks = {
//     mysql: false,
//     redis: false
//   };

//   try {
//     const [rows] = await mysqlPool.query("SELECT 1 AS ok");
//     checks.mysql = Array.isArray(rows);
//   } catch (err) {
//     console.error("MySQL health check failed:", err.message);
//   }

//   try {
//     await redisClient.ping();
//     checks.redis = true;
//   } catch (err) {
//     console.error("Redis health check failed:", err.message);
//   }

//   const ok = checks.mysql && checks.redis;
//   res.status(ok ? 200 : 500).json({ ok, checks });
// });

app.get("/", (_req, res) => {
  res.json({ message: "Backend is running." });
});

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*"
  }
});

// In-memory auction state for the interview exercise.
const store = new MockAuctionStore();
const engine = createAuctionEngine(store);
const emitWithJitter = (eventName, payload) => {
  const delay = randomBetween(...EVENT_DELAY_RANGE_MS);

  setTimeout(() => {
    io.emit(eventName, {
      ...payload,
      emittedAt: Date.now(),
      transportDelayMs: delay
    });
  }, delay);
};

/**
 * GET /auction - Get current auction state
 */
app.get("/auction", (_req, res) => {
  try {
    const snapshot = engine.getSnapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /bid - Place a bid on the current vehicle
 *
 * Body: { userId: string, amount: number, requestId?: string }
 *
 * The transport is intentionally more realistic than v1:
 * 1. The command path is REST and returns an authoritative snapshot
 * 2. The event path is jittered via WebSocket to simulate late/out-of-order updates
 * 3. Clients must reconcile optimistic local state against both
 */
app.post("/bid", async (req, res) => {
  try {
    const { userId, amount, requestId, expectedVersion } = req.body;
    console.log(
      `\n[BID RECEIVED] userId: ${userId}, amount: $${amount}, requestId: ${requestId || "auto"}`
    );

    // Basic validation
    if (!userId || typeof amount !== "number") {
      console.log("[BID REJECTED] Invalid request body");
      return res.status(400).json({
        error: "Invalid request. Required: { userId: string, amount: number }"
      });
    }

    console.log("[BID] Calling engine.applyBid()...");
    const result = await engine.applyBid({ userId, amount, requestId, expectedVersion });
    console.log("[BID RESULT]", result);

    if (result.accepted) {
      emitWithJitter("auction:bid-update", {
        requestId: result.requestId,
        vehicle: result.vehicle,
        users: result.users,
        snapshotVersion: result.snapshotVersion,
        timestamp: Date.now()
      });

      if (result.sold) {
        setTimeout(() => {
          const advanceResult = store.advanceToNextVehicle();
          if (advanceResult.advanced) {
            emitWithJitter("auction:vehicle-advance", {
              snapshot: advanceResult.snapshot,
              timestamp: Date.now()
            });
          } else {
            emitWithJitter("auction:ended", {
              snapshot: advanceResult.snapshot,
              timestamp: Date.now()
            });
          }
        }, VEHICLE_ADVANCE_DELAY_MS);
      }
    }

    res.json(result);
  } catch (error) {
    console.error("[BID ERROR]", error);
    console.error("This is expected if applyBid() is not implemented yet.");
    res.status(500).json({
      accepted: false,
      error: error.message
    });
  }
});

/**
 * WebSocket connection handler
 */
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send initial auction snapshot when client connects
  socket.emit("auction:snapshot", engine.getSnapshot());

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const port = Number(process.env.PORT) || 3000;
httpServer.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
  console.log(`WebSocket server ready`);
});

process.on("SIGINT", async () => {
  if (typeof redisClient !== "undefined") {
    await redisClient.quit();
  }
  if (typeof mysqlPool !== "undefined") {
    await mysqlPool.end();
  }
  process.exit(0);
});
