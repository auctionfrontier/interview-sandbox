const { MockAuctionStore } = require("./mockAuctionStore");

/**
 * Creates an auction engine to handle bid processing.
 *
 * TODO for interview candidate:
 * - Implement the applyBid() method with proper validation
 * - Handle race conditions (consider using Redis for locking)
 * - Manage credit reservations properly
 * - Handle vehicle advancement when target price is reached
 *
 * @param {MockAuctionStore} store
 * @returns {object}
 */
const createAuctionEngine = (store) => {
  if (!(store instanceof MockAuctionStore)) {
    throw new Error("Auction engine requires a MockAuctionStore instance");
  }

  return {
    /**
     * Returns current auction snapshot for clients.
     * @returns {object}
     */
    getSnapshot() {
      return store.getSnapshot();
    },

    /**
     * Apply a bid to the current vehicle.
     *
     * This is the main method the interview candidate needs to implement.
     *
     * Requirements:
     * 1. Validate bid is higher than current bid
     * 2. Validate user exists and has sufficient credit
     * 3. Update vehicle's currentBid and currentWinner
     * 4. If bid >= targetPrice:
     *    - Mark vehicle as sold (winner = userId, soldAt = timestamp)
     *    - Schedule automatic advance to next vehicle after 10 seconds
     * 5. Update user's credit usage (release old bid, reserve new bid)
     * 6. Return response indicating success/failure with appropriate data
     *
     * Race condition considerations:
     * - Multiple bids can arrive simultaneously
     * - Need to ensure only one bid wins
     * - Consider using Redis locks or similar mechanism
     *
     * @param {{userId: string, amount: number}} bid
     * @returns {{accepted: boolean, reason?: string, vehicle?: object, user?: object}}
     */
    applyBid(bid) {
      // TODO: Implement bid processing logic
      // This is intentionally left for the interview candidate to implement

      throw new Error("applyBid() is not implemented yet - this is the interview challenge!");
    }
  };
};

module.exports = { createAuctionEngine };
