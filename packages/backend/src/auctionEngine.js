const { MockAuctionStore } = require("./mockAuctionStore");

const createAuctionEngine = (store) => {
  if (!(store instanceof MockAuctionStore)) {
    throw new Error("Auction engine requires a MockAuctionStore instance");
  }

  return {
    getSnapshot() {
      return store.getSnapshot();
    },
    applyBid(_bid) {
      // TODO: implement bid validation, ordering, and state updates.
      // The golden-path test covers a valid higher bid and should pass once implemented.
      throw new Error("applyBid is not implemented yet");
    }
  };
};

module.exports = { createAuctionEngine };
