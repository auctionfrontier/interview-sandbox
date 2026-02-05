import { makeAutoObservable, runInAction } from "mobx";
import { io } from "socket.io-client";

const DEFAULT_WS_URL = "http://localhost:3000";

/**
 * MobX store that maintains auction state and socket connectivity.
 */
export class AuctionStore {
  /** @type {Array<object>} */
  vehicles = [];
  /** @type {string} */
  currentVehicleId = "";
  /** @type {Record<string, object|null>} */
  highestBids = {};
  /** @type {string} */
  state = "PREVIEW";
  /** @type {Array<object>} */
  events = [];
  /** @type {boolean} */
  connected = false;

  /**
   * @param {string} [socketUrl]
   */
  constructor(socketUrl = DEFAULT_WS_URL) {
    makeAutoObservable(this);

    // Connect immediately to receive snapshots and events.
    this.socket = io(socketUrl, {
      transports: ["websocket"]
    });

    this.socket.on("connect", () => {
      runInAction(() => {
        this.connected = true;
      });
    });

    this.socket.on("disconnect", () => {
      runInAction(() => {
        this.connected = false;
      });
    });

    this.socket.on("auction:snapshot", (snapshot) => {
      runInAction(() => {
        // Replace all critical state on snapshot to ensure consistency.
        this.vehicles = snapshot.vehicles;
        this.currentVehicleId = snapshot.currentVehicleId;
        this.highestBids = snapshot.highestBids || {};
        this.state = snapshot.state;
      });
    });

    this.socket.on("auction:event", (event) => {
      runInAction(() => {
        // Keep a rolling window for interviewer visibility.
        this.events = [event, ...this.events].slice(0, 20);
        if (event.type === "BID_ACCEPTED") {
          const bid = event.payload;
          this.highestBids[bid.vehicleId] = bid;
        }
        if (event.type === "STATE_CHANGED") {
          this.state = event.payload.state;
          this.currentVehicleId = event.payload.currentVehicleId;
        }
      });
    });
  }

  /**
   * @returns {object|undefined} current vehicle from the snapshot
   */
  get currentVehicle() {
    return this.vehicles.find((vehicle) => vehicle.id === this.currentVehicleId);
  }

  /**
   * Submit a bid for the currently active vehicle.
   * @param {number} amount
   * @param {string} bidderId
   */
  placeBid(amount, bidderId) {
    if (!this.currentVehicleId) return;
    this.socket.emit("bid:place", {
      vehicleId: this.currentVehicleId,
      amount,
      bidderId
    });
  }
}
