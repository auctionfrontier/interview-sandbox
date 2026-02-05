const t = require("tap");
const { createAuctionEngine } = require("../auctionEngine");
const { MockAuctionStore } = require("../mockAuctionStore");

t.test("auction engine: accepts a valid higher bid", (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  const result = engine.applyBid({
    userId: "user-1",
    amount: 9000
  });

  t.ok(result.accepted, "bid should be accepted");
  t.equal(result.vehicle.currentBid, 9000, "current bid should be updated");
  t.equal(result.vehicle.currentWinner, "user-1", "user-1 should be winning");
  t.end();
});

t.test("auction engine: rejects a bid lower than current bid", (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  // First bid
  engine.applyBid({ userId: "user-1", amount: 9000 });

  // Try lower bid
  const result = engine.applyBid({ userId: "user-2", amount: 8800 });

  t.notOk(result.accepted, "bid should be rejected");
  t.match(result.reason, /lower/i, "reason should mention bid is too low");
  t.end();
});

t.test("auction engine: rejects bid when user has insufficient credit", (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  // User-1 has $50,000 credit limit
  const result = engine.applyBid({
    userId: "user-1",
    amount: 60000
  });

  t.notOk(result.accepted, "bid should be rejected");
  t.match(result.reason, /credit/i, "reason should mention insufficient credit");
  t.end();
});

t.test("auction engine: marks vehicle as sold when target price reached", (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  // Target price for veh-001 is $11,000
  const result = engine.applyBid({
    userId: "user-1",
    amount: 11000
  });

  t.ok(result.accepted, "bid should be accepted");
  t.equal(result.vehicle.winner, "user-1", "user-1 should be the winner");
  t.ok(result.vehicle.soldAt, "soldAt timestamp should be set");
  t.end();
});

t.test("auction engine: updates user credit when bid is accepted", (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  engine.applyBid({ userId: "user-1", amount: 9000 });

  const snapshot = engine.getSnapshot();
  const user = snapshot.users.find(u => u.id === "user-1");

  t.equal(user.creditUsed, 9000, "user's credit should be reserved");
  t.equal(user.availableCredit, 41000, "available credit should be reduced");
  t.end();
});

t.test("auction engine: releases previous bid when user bids again", (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  // First bid
  engine.applyBid({ userId: "user-1", amount: 9000 });

  // User-1 bids again (higher)
  engine.applyBid({ userId: "user-1", amount: 10000 });

  const snapshot = engine.getSnapshot();
  const user = snapshot.users.find(u => u.id === "user-1");

  t.equal(user.creditUsed, 10000, "only latest bid should be reserved");
  t.equal(user.availableCredit, 40000, "credit should reflect only current bid");
  t.end();
});
