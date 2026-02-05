const t = require("tap");
const { createAuctionEngine } = require("../auctionEngine");
const { MockAuctionStore } = require("../mockAuctionStore");

const makeBid = (amount) => ({
  id: `bid-${amount}`,
  vehicleId: "veh-001",
  amount,
  bidderId: "lane-7",
  timestamp: Date.now()
});

t.test("auction engine: accepts a higher bid and updates the snapshot (golden path)", (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  const events = engine.applyBid(makeBid(9000));
  const snapshot = engine.getSnapshot();

  t.ok(events.length > 0, "emits at least one event");
  t.equal(snapshot.highestBids["veh-001"]?.amount, 9000);
});
