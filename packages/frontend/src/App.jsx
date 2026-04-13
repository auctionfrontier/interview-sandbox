import React, { useEffect, useState } from "react";
import { useAuctionStore } from "./store/auctionStore";
import { useAutoBidders } from "./hooks/useAutoBidders";

const formatCurrency = (amount = 0) => `$${amount.toLocaleString()}`;

const describeEvent = (event) => {
  switch (event.type) {
    case "BID_PENDING":
      return `Pending bid ${formatCurrency(event.payload.amount)} on ${event.payload.vehicleId}`;
    case "BID_SUBMITTED":
      return `Submitted background bid ${formatCurrency(event.payload.amount)} on ${event.payload.vehicleId}`;
    case "BID_CONFIRMED":
      return `Confirmed bid ${formatCurrency(event.payload.amount)} on ${event.payload.vehicleId}`;
    case "BID_REJECTED":
      return event.payload.reason || "Bid was rejected";
    case "BID_STREAM_APPLIED":
      return `Applied stream update for ${event.payload.vehicleId} v${event.payload.version}`;
    case "BID_STREAM_IGNORED":
      return `Ignored stale stream update for ${event.payload.vehicleId} v${event.payload.version}`;
    case "SNAPSHOT_APPLIED":
      return `Applied ${event.payload.source} snapshot v${event.payload.snapshotVersion}`;
    case "SNAPSHOT_ERROR":
      return `Snapshot error: ${event.payload.error}`;
    case "SOCKET_CONNECTED":
      return "Socket connected";
    case "SOCKET_DISCONNECTED":
      return "Socket disconnected";
    case "BID_ERROR":
      return event.payload.error;
    default:
      return event.type;
  }
};

const App = () => {
  const {
    connected,
    state,
    currentVehicle,
    users,
    initSocket,
    placeBid,
    pendingBid,
    syncStatus,
    lastError,
    snapshotVersion,
    events,
    fetchSnapshot
  } = useAuctionStore();

  const [myUserId] = useState("user-1");
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const myUser = users.find((user) => user.id === myUserId);
  const isSubmitting = pendingBid?.userId === myUserId;

  useAutoBidders(simulationEnabled);

  useEffect(() => {
    initSocket();
  }, [initSocket]);

  const currentBid = currentVehicle?.currentBid || 0;
  const targetPrice = currentVehicle?.targetPrice || 0;
  const startingBid = currentVehicle?.startingBid || 0;
  const isNewItem = currentBid === startingBid;
  const amIWinning = currentVehicle?.currentWinner === myUserId;
  const isSold = !!currentVehicle?.winner;
  const winner = users.find((user) => user.id === currentVehicle?.winner);
  const nextBidAmount = currentBid + 100;
  const canBid =
    connected &&
    !isSold &&
    state !== "ENDED" &&
    !isSubmitting &&
    (!myUser || myUser.availableCredit >= nextBidAmount);

  const handleBid = async () => {
    if (!canBid) {
      return;
    }

    await placeBid(myUserId, nextBidAmount);
  };

  const handleRefresh = async () => {
    try {
      await fetchSnapshot("manual-refresh");
    } catch {
      // fetchSnapshot already stores the error for the UI
    }
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
          <span className="sync-chip">Sync: {syncStatus}</span>
          <span className="sync-chip">Snapshot v{snapshotVersion}</span>
          <span className="sync-chip">Vehicle v{currentVehicle.version}</span>
          {myUser && (
            <span className="credit-display">
              Available Credit: {formatCurrency(myUser.availableCredit)}
            </span>
          )}
          <button className="refresh-button" onClick={handleRefresh}>
            Refresh Snapshot
          </button>
          <button
            className={`simulation-toggle ${simulationEnabled ? "enabled" : "disabled"}`}
            onClick={() => setSimulationEnabled(!simulationEnabled)}
            title={simulationEnabled ? "Disable auto-bidders" : "Enable auto-bidders"}
          >
            <span className="toggle-icon">{simulationEnabled ? "⏸" : "▶"}</span>
            <span className="toggle-text">Auto-Bidders: {simulationEnabled ? "ON" : "OFF"}</span>
          </button>
        </div>
      </header>

      <main className="auction-main">
        <section className="status-strip">
          <div className={`status-card ${pendingBid ? "status-card-pending" : "status-card-neutral"}`}>
            <span className="status-card-label">Command</span>
            <strong>
              {pendingBid
                ? `Submitting ${formatCurrency(pendingBid.amount)} on ${pendingBid.vehicleId}`
                : "No local bid in flight"}
            </strong>
          </div>
          <div className={`status-card ${currentVehicle.optimistic ? "status-card-pending" : "status-card-neutral"}`}>
            <span className="status-card-label">View</span>
            <strong>
              {currentVehicle.optimistic
                ? "Optimistic state awaiting confirmation"
                : "Authoritative snapshot applied"}
            </strong>
          </div>
          <div className={`status-card ${lastError ? "status-card-error" : "status-card-neutral"}`}>
            <span className="status-card-label">Recoverability</span>
            <strong>{lastError || "No active transport errors"}</strong>
          </div>
        </section>

        <section className="vehicle-section">
          <div className="vehicle-number">#{currentVehicle.id}</div>
          <h1 className="vehicle-title">
            {currentVehicle.year} {currentVehicle.make} {currentVehicle.model}
          </h1>
          <p className="vehicle-vin">VIN: {currentVehicle.vin}</p>
        </section>

        <section className="vehicle-image-section">
          <img
            src={`/images/${currentVehicle.id}.jpeg`}
            alt={`${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model}`}
            onError={(event) => {
              event.target.parentElement.style.display = "none";
            }}
          />
        </section>

        <section className="bid-display">
          <div className={`bid-panel left ${amIWinning ? "winning" : "asking"}`}>
            {isSold ? (
              <>
                <div className="label">SOLD</div>
                <div className="amount">{formatCurrency(currentBid)}</div>
                {currentVehicle.winner === myUserId ? (
                  <div className="status-text">You won!</div>
                ) : (
                  <div className="status-text">Better luck next time</div>
                )}
              </>
            ) : amIWinning ? (
              <>
                <div className="status-text">
                  {currentVehicle.optimistic ? "You appear to be leading" : "You are the high bidder"}
                </div>
                <div className="amount">{formatCurrency(currentBid)}</div>
              </>
            ) : isNewItem ? (
              <>
                <div className="label">ASKING</div>
                <div className="amount">{formatCurrency(startingBid)}</div>
              </>
            ) : (
              <>
                <div className="label">CURRENT BID</div>
                <div className="amount">{formatCurrency(currentBid)}</div>
              </>
            )}
          </div>

          <div className={`bid-panel right ${amIWinning ? "my-winning" : "bid-action"}`}>
            {isSold ? (
              <>
                <div className="label">WINNER</div>
                <div className="winner-badge">
                  <span className="winner-icon">👤</span>
                  <span className="winner-name">{winner?.badge || "Unknown"}</span>
                </div>
                <div className="amount">{formatCurrency(currentBid)}</div>
              </>
            ) : amIWinning ? (
              <>
                <div className="label">{currentVehicle.optimistic ? "PENDING LEAD" : "WINNING"}</div>
                <div className="winner-badge">
                  <span className="winner-icon">👤</span>
                  <span className="winner-name">{myUser?.badge || "You"}</span>
                </div>
                <div className="amount">{formatCurrency(currentBid)}</div>
              </>
            ) : (
              <button className="bid-button" onClick={handleBid} disabled={!canBid}>
                <div className="bid-label">{isSubmitting ? "SUBMITTING" : "BID"}</div>
                <div className="bid-amount">{formatCurrency(nextBidAmount)}</div>
              </button>
            )}
          </div>
        </section>

        {!isSold && (
          <section className="progress-section">
            <div className="progress-info">
              <span>Target Price: {formatCurrency(targetPrice)}</span>
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

        {isSold && (
          <section className="countdown-section">
            <div className="countdown-message">
              Next vehicle in 5 seconds...
            </div>
          </section>
        )}

        <section className="events-panel">
          <div className="events-header">
            <h2>Transport Timeline</h2>
            <span>{events.length} recent events</span>
          </div>
          <div className="events-list">
            {events.length === 0 ? (
              <div className="event-item muted">No events yet.</div>
            ) : (
              events.slice(0, 8).map((event) => (
                <div className="event-item" key={`${event.type}-${event.timestamp}`}>
                  <span className="event-type">{event.type}</span>
                  <span className="event-detail">{describeEvent(event)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
