import { makeAutoObservable, runInAction } from "mobx";
import { io } from "socket.io-client";

const DEFAULT_WS_URL = "http://localhost:3000";

export class AuctionStore {
  vehicles = [];
  currentVehicleId = "";
  highestBids = {};
  state = "PREVIEW";
  events = [];
  connected = false;

  constructor(socketUrl = DEFAULT_WS_URL) {
    makeAutoObservable(this);

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
        this.vehicles = snapshot.vehicles;
        this.currentVehicleId = snapshot.currentVehicleId;
        this.highestBids = snapshot.highestBids || {};
        this.state = snapshot.state;
      });
    });

    this.socket.on("auction:event", (event) => {
      runInAction(() => {
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

  get currentVehicle() {
    return this.vehicles.find((vehicle) => vehicle.id === this.currentVehicleId);
  }

  placeBid(amount, bidderId) {
    if (!this.currentVehicleId) return;
    this.socket.emit("bid:place", {
      vehicleId: this.currentVehicleId,
      amount,
      bidderId
    });
  }
}
