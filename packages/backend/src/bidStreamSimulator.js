const defaultBidders = ["lane-7", "lane-12", "remote-44", "remote-58"];

const startBidStreamSimulator = ({
  engine,
  intervalMs = 1500,
  bidders = defaultBidders,
  onEvents
}) => {
  const timer = setInterval(() => {
    const snapshot = engine.getSnapshot();
    const vehicleId = snapshot.currentVehicleId;
    if (!vehicleId) return;

    const currentBid = snapshot.highestBids[vehicleId]?.amount ?? 0;
    const increment = Math.ceil(Math.random() * 500);

    const bid = {
      id: `sim-${Date.now()}`,
      vehicleId,
      amount: currentBid + increment,
      bidderId: bidders[Math.floor(Math.random() * bidders.length)],
      timestamp: Date.now()
    };

    try {
      const events = engine.applyBid(bid);
      if (onEvents) onEvents(events);
    } catch {
      // Swallow errors so the simulator doesn't crash the server while logic is incomplete.
    }
  }, intervalMs);

  return () => clearInterval(timer);
};

module.exports = { startBidStreamSimulator };
