import React, { useEffect, useState } from "react";
import { useAuctionStore } from "./store/auctionStore";
import { useAutoBidders } from "./hooks/useAutoBidders";

const App = () => {
  const {
    connected,
    state,
    currentVehicle,
    users,
    initSocket,
    placeBid
  } = useAuctionStore();

  const [myUserId] = useState("user-1"); // You are always user-1
  const myUser = users.find(u => u.id === myUserId);

  // Start automated bidders (user-2 and user-3)
  useAutoBidders();

  // Initialize WebSocket on mount
  useEffect(() => {
    initSocket();
  }, [initSocket]);

  const currentBid = currentVehicle?.currentBid || 0;
  const targetPrice = currentVehicle?.targetPrice || 0;
  const startingBid = currentVehicle?.startingBid || 0;
  const isNewItem = currentBid === startingBid;

  // Am I winning?
  const amIWinning = currentVehicle?.currentWinner === myUserId;
  const isSold = !!currentVehicle?.winner;
  const winner = users.find(u => u.id === currentVehicle?.winner);

  // Calculate next bid increment - fixed $100
  const nextBidAmount = currentBid + 100;

  const handleBid = async () => {
    if (isSold || state === "ENDED" || !connected) {
      console.log("Bid blocked:", { isSold, state, connected });
      return;
    }

    // Check if I have enough credit
    if (myUser && myUser.availableCredit < nextBidAmount) {
      alert(`Insufficient credit! You have $${myUser.availableCredit.toLocaleString()} available.`);
      return;
    }

    console.log("Placing bid:", { userId: myUserId, amount: nextBidAmount });
    const result = await placeBid(myUserId, nextBidAmount);
    console.log("Bid result:", result);
  };

  if (!currentVehicle) {
    return (
      <div className="auction-container">
        <div className="loading">Loading auction...</div>
      </div>
    );
  }

  return (
    <div className="auction-container">
      <header className="auction-header">
        <div className="connection-status">
          <div className={`status-dot ${connected ? "online" : "offline"}`}></div>
          <span>{connected ? "Live" : "Disconnected"}</span>
        </div>
        <div className="auction-info">
          <span>Auction #{currentVehicle.id}</span>
          {myUser && (
            <span className="credit-display">
              Available Credit: ${myUser.availableCredit?.toLocaleString()}
            </span>
          )}
        </div>
      </header>

      <main className="auction-main">
        {/* Vehicle Info Section */}
        <section className="vehicle-section">
          <div className="vehicle-number">#{currentVehicle.id}</div>
          <h1 className="vehicle-title">
            {currentVehicle.year} {currentVehicle.make} {currentVehicle.model}
          </h1>
          <p className="vehicle-vin">VIN: {currentVehicle.vin}</p>
        </section>

        {/* Vehicle Image */}
        <section className="vehicle-image-section">
          <img
            src={`/images/${currentVehicle.id}.jpeg`}
            alt={`${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model}`}
            onError={(e) => {
              e.target.parentElement.style.display = 'none';
            }}
          />
        </section>

        {/* Bidding Display */}
        <section className="bid-display">
          {/* Left Side - Asking/Your Status */}
          <div className={`bid-panel left ${amIWinning ? "winning" : "asking"}`}>
            {isSold ? (
              <>
                <div className="label">SOLD</div>
                <div className="amount">${currentBid.toLocaleString()}</div>
                {currentVehicle.winner === myUserId ? (
                  <div className="status-text">You won!</div>
                ) : (
                  <div className="status-text">Better luck next time</div>
                )}
              </>
            ) : amIWinning ? (
              <>
                <div className="status-text">You are the high bidder</div>
                <div className="amount">${currentBid.toLocaleString()}</div>
              </>
            ) : isNewItem ? (
              <>
                <div className="label">ASKING</div>
                <div className="amount">${startingBid.toLocaleString()}</div>
              </>
            ) : (
              <>
                <div className="label">CURRENT BID</div>
                <div className="amount">${currentBid.toLocaleString()}</div>
              </>
            )}
          </div>

          {/* Right Side - Bid Button or Winning Info */}
          <div className={`bid-panel right ${amIWinning ? "my-winning" : "bid-action"}`}>
            {isSold ? (
              <>
                <div className="label">WINNER</div>
                <div className="winner-badge">
                  <span className="winner-icon">👤</span>
                  <span className="winner-name">{winner?.badge || "Unknown"}</span>
                </div>
                <div className="amount">${currentBid.toLocaleString()}</div>
              </>
            ) : amIWinning ? (
              <>
                <div className="label">WINNING</div>
                <div className="winner-badge">
                  <span className="winner-icon">👤</span>
                  <span className="winner-name">{myUser?.badge || "You"}</span>
                </div>
                <div className="amount">${currentBid.toLocaleString()}</div>
              </>
            ) : (
              <button
                className="bid-button"
                onClick={handleBid}
                disabled={!connected || state === "ENDED"}
              >
                <div className="bid-label">BID</div>
                <div className="bid-amount">${nextBidAmount.toLocaleString()}</div>
              </button>
            )}
          </div>
        </section>

        {/* Progress to Target */}
        {!isSold && (
          <section className="progress-section">
            <div className="progress-info">
              <span>Target Price: ${targetPrice.toLocaleString()}</span>
              <span>{Math.round((currentBid / targetPrice) * 100)}% to target</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min((currentBid / targetPrice) * 100, 100)}%` }}
              ></div>
            </div>
          </section>
        )}

        {/* Countdown when sold */}
        {isSold && (
          <section className="countdown-section">
            <div className="countdown-message">
              Next vehicle in 10 seconds...
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;
