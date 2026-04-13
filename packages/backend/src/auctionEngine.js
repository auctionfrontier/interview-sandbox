const { randomUUID } = require("node:crypto");
const { MockAuctionStore } = require("./mockAuctionStore");
const { VehicleState } = require("./models");

const PROCESSING_DELAY_RANGE_MS = [80, 220];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomBetween = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const createMutex = () => {
  let tail = Promise.resolve();

  return async (work) => {
    let release = () => {};
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const previous = tail;
    tail = current;

    await previous;

    try {
      return await work();
    } finally {
      release();
    }
  };
};

const createRejectedResult = ({
  store,
  requestId,
  reason,
  currentVehicleId,
  staleClientView = false
}) => {
  const snapshot = store.getSnapshot();

  return {
    accepted: false,
    requestId,
    reason,
    currentVehicleId,
    staleClientView,
    snapshotVersion: snapshot.snapshotVersion,
    snapshot
  };
};

/**
 * Creates an auction engine to handle bid processing.
 *
 * The important shift from v1 is that bid processing is now async and stateful.
 * Shared in-memory state can still race once `await` is involved, so the engine
 * serializes mutations even though Node.js runs JavaScript on a single thread.
 *
 * @param {MockAuctionStore} store
 * @returns {object}
 */
const createAuctionEngine = (store) => {
  if (!(store instanceof MockAuctionStore)) {
    throw new Error("Auction engine requires a MockAuctionStore instance");
  }

  const processedRequests = new Map();
  const withBidLock = createMutex();

  const simulateAsyncDependency = async () => {
    await sleep(randomBetween(...PROCESSING_DELAY_RANGE_MS));
  };

  return {
    getSnapshot() {
      return store.getSnapshot();
    },

    /**
     * Apply a bid to the current vehicle.
     *
     * Contract:
     * - Requests may arrive concurrently.
     * - Responses include an authoritative snapshot for client reconciliation.
     * - requestId is treated idempotently if the client retries.
     *
     * @param {{userId: string, amount: number, requestId?: string, expectedVersion?: number}} bid
     * @returns {Promise<object>}
     */
    async applyBid(bid) {
      const requestId = bid.requestId || randomUUID();

      if (processedRequests.has(requestId)) {
        return processedRequests.get(requestId);
      }

      const result = await withBidLock(async () => {
        if (processedRequests.has(requestId)) {
          return processedRequests.get(requestId);
        }

        await simulateAsyncDependency();

        const vehicle = store.getCurrentVehicle();
        if (!vehicle) {
          return createRejectedResult({
            store,
            requestId,
            reason: "Auction has ended.",
            currentVehicleId: null
          });
        }

        const staleClientView =
          typeof bid.expectedVersion === "number" &&
          bid.expectedVersion !== vehicle.version;

        // TODO(candidate): define the stale bid policy.
        // Right now the engine only surfaces that the client bid against an older
        // version and still evaluates the bid against live state. That is not
        // necessarily the product behavior we want.

        if (vehicle.state !== VehicleState.ACTIVE || vehicle.winner) {
          return createRejectedResult({
            store,
            requestId,
            reason: "Vehicle is no longer accepting bids.",
            currentVehicleId: vehicle.id,
            staleClientView
          });
        }

        const user = store.getUser(bid.userId);
        if (!user) {
          return createRejectedResult({
            store,
            requestId,
            reason: "Unknown bidder.",
            currentVehicleId: vehicle.id,
            staleClientView
          });
        }

        if (typeof bid.amount !== "number" || Number.isNaN(bid.amount)) {
          return createRejectedResult({
            store,
            requestId,
            reason: "Bid amount must be a number.",
            currentVehicleId: vehicle.id,
            staleClientView
          });
        }

        if (bid.amount <= vehicle.currentBid) {
          return createRejectedResult({
            store,
            requestId,
            reason: "Bid is lower than the current bid.",
            currentVehicleId: vehicle.id,
            staleClientView
          });
        }

        const previousWinnerId = vehicle.currentWinner;
        const previousWinningBid = previousWinnerId ? vehicle.currentBid : 0;
        const previousBidForUser =
          previousWinnerId === user.id ? previousWinningBid : 0;
        const additionalCreditRequired = bid.amount - previousBidForUser;
        const availableCredit = user.creditLimit - user.creditUsed;

        if (availableCredit < additionalCreditRequired) {
          return createRejectedResult({
            store,
            requestId,
            reason: "User has insufficient credit.",
            currentVehicleId: vehicle.id,
            staleClientView
          });
        }

        await simulateAsyncDependency();

        const affectedUsers = [];
        if (previousWinnerId && previousWinnerId !== user.id) {
          const releasedUser = store.updateUserCredit(
            previousWinnerId,
            previousWinningBid,
            0
          );
          if (releasedUser) {
            affectedUsers.push(releasedUser);
          }
        }

        const updatedUser = store.updateUserCredit(
          user.id,
          previousBidForUser,
          bid.amount
        );
        if (updatedUser) {
          affectedUsers.push(updatedUser);
        }

        const acceptedAt = Date.now();
        vehicle.currentBid = bid.amount;
        vehicle.currentWinner = user.id;
        vehicle.winner = bid.amount >= vehicle.targetPrice ? user.id : null;
        vehicle.soldAt = vehicle.winner ? acceptedAt : null;
        vehicle.state = vehicle.winner ? VehicleState.SOLD : VehicleState.ACTIVE;
        store.recordBid(vehicle.id, {
          requestId,
          userId: user.id,
          amount: bid.amount,
          acceptedAt
        });

        const vehicleSnapshot = store.markVehicleUpdated(vehicle, acceptedAt);
        const snapshot = store.getSnapshot();
        const resultPayload = {
          accepted: true,
          requestId,
          currentVehicleId: vehicle.id,
          staleClientView,
          snapshotVersion: snapshot.snapshotVersion,
          vehicle: vehicleSnapshot,
          users: affectedUsers,
          sold: Boolean(vehicle.winner),
          snapshot
        };

        processedRequests.set(requestId, resultPayload);
        return resultPayload;
      });

      processedRequests.set(requestId, result);
      return result;
    }
  };
};

module.exports = { createAuctionEngine };
