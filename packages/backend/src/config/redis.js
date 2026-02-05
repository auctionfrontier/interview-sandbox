const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisClient.on("error", (err) => {
  console.error("Redis client error:", err.message);
});

redisClient.connect().catch((err) => {
  console.error("Failed to connect to Redis:", err.message);
});

module.exports = { redisClient };
