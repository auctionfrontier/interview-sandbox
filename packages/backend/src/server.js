const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createServer } = require("node:http");
const { Server: SocketIOServer } = require("socket.io");
// If containerization is available, can add these in
// const { mysqlPool } = require("./config/mysql");
// const { redisClient } = require("./config/redis");
const { createAuctionEngine } = require("./auctionEngine");
const { MockAuctionStore } = require("./mockAuctionStore");

dotenv.config();

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
 * Body: { userId: string, amount: number }
 *
 * This is the main endpoint the interview candidate needs to implement.
 * It should:
 * 1. Validate the bid
 * 2. Process the bid through the auction engine
 * 3. Broadcast updates via WebSocket
 * 4. Return appropriate response
 */
app.post("/bid", async (req, res) => {
  try {
    const { userId, amount } = req.body;
    console.log(`\n[BID RECEIVED] userId: ${userId}, amount: $${amount}`);

    // Basic validation
    if (!userId || typeof amount !== "number") {
      console.log("[BID REJECTED] Invalid request body");
      return res.status(400).json({
        error: "Invalid request. Required: { userId: string, amount: number }"
      });
    }

    // TODO: Interview candidate implements this in auctionEngine.applyBid()
    console.log("[BID] Calling engine.applyBid()...");
    const result = engine.applyBid({ userId, amount });
    console.log("[BID RESULT]", result);

    if (result.accepted) {
      // Broadcast bid update to all connected clients
      io.emit("auction:bid-update", {
        vehicle: result.vehicle,
        user: result.user,
        timestamp: Date.now()
      });

      // If vehicle was sold, schedule advancement to next vehicle
      if (result.vehicle.winner) {
        setTimeout(() => {
          const advanced = store.advanceToNextVehicle();
          if (advanced) {
            io.emit("auction:vehicle-advance", {
              currentVehicle: store.getCurrentVehicle(),
              currentVehicleIndex: store.currentVehicleIndex,
              timestamp: Date.now()
            });
          } else {
            io.emit("auction:ended", {
              timestamp: Date.now()
            });
          }
        }, 10000); // 10 second delay before advancing
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
  await redisClient.quit();
  await mysqlPool.end();
  process.exit(0);
});
