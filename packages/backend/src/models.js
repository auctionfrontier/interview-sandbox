const AuctionState = {
  PREVIEW: "PREVIEW",
  LIVE: "LIVE",
  ENDED: "ENDED"
};

const AuctionEventType = {
  AUCTION_SNAPSHOT: "AUCTION_SNAPSHOT",
  BID_ACCEPTED: "BID_ACCEPTED",
  BID_REJECTED: "BID_REJECTED",
  STATE_CHANGED: "STATE_CHANGED",
  ERROR: "ERROR"
};

module.exports = { AuctionState, AuctionEventType };
