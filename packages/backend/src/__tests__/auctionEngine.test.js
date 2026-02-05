const { describe, expect, it } = require("vitest");
const { createAuctionEngine } = require("../auctionEngine");
const { MockAuctionStore } = require("../mockAuctionStore");

const makeBid = (amount) => ({
  id: `bid-${amount}`,
  vehicleId: "veh-001",
  amount,
  bidderId: "lane-7",
  timestamp: Date.now()
});

describe("auction engine", () => {
  it("accepts a higher bid and updates the snapshot (golden path)", () => {
    const store = new MockAuctionStore();
    const engine = createAuctionEngine(store);

    const events = engine.applyBid(makeBid(9000));
    const snapshot = engine.getSnapshot();

    expect(events.length).toBeGreaterThan(0);
    expect(snapshot.highestBids["veh-001"]?.amount).toBe(9000);
  });
});
