/**
 * High-level auction state transitions for the mock simulcast.
 * @readonly
 * @enum {string}
 */
const AuctionState = {
  PREVIEW: "PREVIEW",
  LIVE: "LIVE",
  ENDED: "ENDED"
};

/**
 * Event types emitted to clients over the socket.
 * @readonly
 * @enum {string}
 */
const AuctionEventType = {
  AUCTION_SNAPSHOT: "AUCTION_SNAPSHOT",
  BID_ACCEPTED: "BID_ACCEPTED",
  BID_REJECTED: "BID_REJECTED",
  STATE_CHANGED: "STATE_CHANGED",
  ERROR: "ERROR"
};

module.exports = { AuctionState, AuctionEventType };
