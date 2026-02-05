const { MockAuctionStore } = require("./mockAuctionStore");

/**
 * Auction engine contract used by the socket server and bid simulator.
 * @typedef {Object} AuctionEngine
 * @property {() => object} getSnapshot
 * @property {(bid: object) => Array<object>} applyBid
 */

/**
 * Creates a minimal auction engine around a store.
 * @param {MockAuctionStore} store
 * @returns {AuctionEngine}
 */
const createAuctionEngine = (store) => {
  if (!(store instanceof MockAuctionStore)) {
    throw new Error("Auction engine requires a MockAuctionStore instance");
  }

  return {
    /**
     * @returns {object} Current snapshot for clients.
     */
    getSnapshot() {
      return store.getSnapshot();
    },
    /**
     * Apply a bid and return emitted events.
     * @param {{id: string, vehicleId: string, amount: number, bidderId: string, timestamp: number}} _bid
     * @returns {Array<object>}
     */
    applyBid(_bid) {
      // TODO: implement bid validation, ordering, and state updates.
      // The golden-path test covers a valid higher bid and should pass once implemented.
      throw new Error("applyBid is not implemented yet");
    }
  };
};

module.exports = { createAuctionEngine };
