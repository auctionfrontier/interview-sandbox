import React, { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { AuctionStore } from "./store/auctionStore";

const App = observer(() => {
  const store = useMemo(() => new AuctionStore(), []);
  const [amount, setAmount] = useState(0);
  const [bidderId, setBidderId] = useState("lane-99");

  const currentBid = store.highestBids[store.currentVehicleId]?.amount ?? 0;
  const minNextBid = currentBid + 100;

  const onSubmit = (event) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed)) return;
    store.placeBid(parsed, bidderId.trim() || "lane-99");
  };

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Auction Frontier (Velocicast)</p>
          <h1>Mock Simulcast Auction</h1>
          <p className="subhead">
            Evaluate concurrency, state consistency, and low-latency updates.
          </p>
        </div>
        <div className={`status ${store.connected ? "online" : "offline"}`}>
          {store.connected ? "Connected" : "Disconnected"}
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Lane Snapshot</h2>
          <div className="snapshot">
            <div>
              <span>State</span>
              <strong>{store.state}</strong>
            </div>
            <div>
              <span>Current Vehicle</span>
              <strong>{store.currentVehicle?.make || "-"}</strong>
            </div>
            <div>
              <span>Highest Bid</span>
              <strong>${currentBid.toLocaleString()}</strong>
            </div>
          </div>

          <div className="vehicle">
            {store.currentVehicle ? (
              <>
                <h3>
                  {store.currentVehicle.year} {store.currentVehicle.make}{" "}
                  {store.currentVehicle.model}
                </h3>
                <p>VIN: {store.currentVehicle.vin}</p>
                <p>Starting bid: ${store.currentVehicle.startingBid}</p>
                <p>
                  Reserve: {store.currentVehicle.reservePrice ?? "No reserve"}
                </p>
              </>
            ) : (
              <p>No vehicle loaded.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Place a Bid</h2>
          <form className="bid-form" onSubmit={onSubmit}>
            <label>
              Bidder ID
              <input
                value={bidderId}
                onChange={(event) => setBidderId(event.target.value)}
                placeholder="lane-99"
              />
            </label>
            <label>
              Bid Amount
              <input
                type="number"
                min={minNextBid}
                step={100}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <button type="submit">Submit Bid</button>
            <p className="hint">Next minimum: ${minNextBid.toLocaleString()}</p>
          </form>
        </section>

        <section className="panel">
          <h2>Recent Events</h2>
          <ul className="events">
            {store.events.map((event) => (
              <li key={event.timestamp}>
                <span>{event.type}</span>
                <pre>{JSON.stringify(event.payload, null, 2)}</pre>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
});

export default App;
