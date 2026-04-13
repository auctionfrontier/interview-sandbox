const t = require("tap");
const { createAuctionEngine } = require("../auctionEngine");
const { MockAuctionStore } = require("../mockAuctionStore");

t.test("auction engine: accepts a valid higher bid", async (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  const result = await engine.applyBid({
    userId: "user-1",
    amount: 9000
  });

  t.ok(result.accepted, "bid should be accepted");
  t.equal(result.vehicle.currentBid, 9000, "current bid should be updated");
  t.equal(result.vehicle.currentWinner, "user-1", "user-1 should be winning");
  t.equal(result.vehicle.version, 2, "vehicle version should increment");
});

t.test("auction engine: rejects a bid lower than current bid", async (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  await engine.applyBid({ userId: "user-1", amount: 9000 });
  const result = await engine.applyBid({ userId: "user-2", amount: 8800 });

  t.notOk(result.accepted, "bid should be rejected");
  t.match(result.reason, /lower/i, "reason should mention bid is too low");
});

t.test("auction engine: rejects bid when user has insufficient credit", async (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  const result = await engine.applyBid({
    userId: "user-1",
    amount: 60000
  });

  t.notOk(result.accepted, "bid should be rejected");
  t.match(result.reason, /credit/i, "reason should mention insufficient credit");
});

t.test("auction engine: marks vehicle as sold when target price reached", async (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  const result = await engine.applyBid({
    userId: "user-1",
    amount: 11000
  });

  t.ok(result.accepted, "bid should be accepted");
  t.equal(result.vehicle.winner, "user-1", "user-1 should be the winner");
  t.ok(result.vehicle.soldAt, "soldAt timestamp should be set");
});

t.test("auction engine: updates user credit when bid is accepted", async (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  await engine.applyBid({ userId: "user-1", amount: 9000 });

  const snapshot = engine.getSnapshot();
  const user = snapshot.users.find((item) => item.id === "user-1");

  t.equal(user.creditUsed, 9000, "user's credit should be reserved");
  t.equal(user.availableCredit, 41000, "available credit should be reduced");
});

t.test("auction engine: releases previous bid when user bids again", async (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  await engine.applyBid({ userId: "user-1", amount: 9000 });
  await engine.applyBid({ userId: "user-1", amount: 10000 });

  const snapshot = engine.getSnapshot();
  const user = snapshot.users.find((item) => item.id === "user-1");

  t.equal(user.creditUsed, 10000, "only latest bid should be reserved");
  t.equal(user.availableCredit, 40000, "credit should reflect only current bid");
});

t.test("auction engine: treats requestId as idempotent", async (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  const first = await engine.applyBid({
    requestId: "repeat-me",
    userId: "user-1",
    amount: 9000
  });
  const second = await engine.applyBid({
    requestId: "repeat-me",
    userId: "user-1",
    amount: 9000
  });

  t.same(second, first, "duplicate request should return cached result");

  const snapshot = engine.getSnapshot();
  const currentVehicle = snapshot.currentVehicle;
  t.equal(currentVehicle.currentBid, 9000, "bid should only be applied once");
  t.equal(currentVehicle.bids.length, 1, "duplicate bid should not be recorded twice");
});

t.test("auction engine: serializes async bids against shared state", async (t) => {
  const store = new MockAuctionStore();
  const engine = createAuctionEngine(store);

  const [first, second] = await Promise.all([
    engine.applyBid({ requestId: "first", userId: "user-1", amount: 9000 }),
    engine.applyBid({ requestId: "second", userId: "user-2", amount: 9000 })
  ]);

  t.ok(first.accepted, "first bid should be accepted");
  t.notOk(second.accepted, "second equal bid should be rejected after serialization");
  t.match(second.reason, /lower/i, "second bid should see the updated current bid");

  const snapshot = engine.getSnapshot();
  t.equal(snapshot.currentVehicle.currentWinner, "user-1", "winner should remain the first bidder");
});
