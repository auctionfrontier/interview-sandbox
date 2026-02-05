const defaultBidders = ["lane-7", "lane-12", "remote-44", "remote-58"];

/**
 * Starts a timer that simulates external bids on the current vehicle.
 * @param {{
 *   engine: { getSnapshot: () => object, applyBid: (bid: {userId: string, amount: number}) => object },
 *   intervalMs?: number,
 *   bidders?: string[],
 *   onResult?: (result: object) => void
 * }} options
 * @returns {() => void} stop function
 */
const startBidStreamSimulator = ({
  engine,
  intervalMs = 1500,
  bidders = defaultBidders,
  onResult
}) => {
  const timer = setInterval(() => {
    const snapshot = engine.getSnapshot();
    const currentVehicle = snapshot.currentVehicle;
    if (!currentVehicle) return;

    const currentBid = currentVehicle.currentBid ?? currentVehicle.startingBid ?? 0;
    const increment = Math.ceil(Math.random() * 500);
    const availableUsers = snapshot.users || [];
    if (availableUsers.length === 0) return;
    const bidderBadge = bidders[Math.floor(Math.random() * bidders.length)];
    const bidder =
      availableUsers.find((user) => user.badge === bidderBadge) ??
      availableUsers[Math.floor(Math.random() * availableUsers.length)];

    const bid = {
      userId: bidder.id,
      amount: currentBid + increment
    };

    try {
      const result = engine.applyBid(bid);
      if (onResult) onResult(result);
    } catch {
      // Swallow errors so the simulator doesn't crash the server while logic is incomplete.
    }
  }, intervalMs);

  return () => clearInterval(timer);
};

module.exports = { startBidStreamSimulator };
