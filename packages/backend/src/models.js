/**
 * Auction state
 * @readonly
 * @enum {string}
 */
const AuctionState = {
  LIVE: "LIVE",
  ENDED: "ENDED"
};

/**
 * Vehicle state
 * @readonly
 * @enum {string}
 */
const VehicleState = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SOLD: "SOLD"
};

module.exports = { AuctionState, VehicleState };
