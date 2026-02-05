import { create } from "zustand";
import { io } from "socket.io-client";

const DEFAULT_WS_URL = "http://localhost:3000";
const API_URL = "http://localhost:3000";

// Initialize socket outside the store so it's a singleton
let socket = null;

export const useAuctionStore = create((set, get) => ({
  // Auction state
  customerId: null,
  eventId: null,
  state: "LIVE",
  users: [],
  vehicles: [],
  currentVehicleIndex: 0,
  currentVehicle: null,

  // Connection state
  connected: false,

  // Events log for debugging
  events: [],

  // Initialize WebSocket connection
  initSocket: () => {
    if (socket) return; // Already initialized

    socket = io(DEFAULT_WS_URL, {
      transports: ["websocket"]
    });

    socket.on("connect", () => {
      console.log("WebSocket connected");
      set({ connected: true });
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
      set({ connected: false });
    });

    // Initial snapshot when connecting
    socket.on("auction:snapshot", (snapshot) => {
      console.log("Received snapshot:", snapshot);
      set({
        customerId: snapshot.customerId,
        eventId: snapshot.eventId,
        state: snapshot.state,
        users: snapshot.users,
        vehicles: snapshot.vehicles,
        currentVehicleIndex: snapshot.currentVehicleIndex,
        currentVehicle: snapshot.currentVehicle
      });

      get().addEvent({
        type: "SNAPSHOT_RECEIVED",
        payload: { vehicleCount: snapshot.vehicles.length },
        timestamp: Date.now()
      });
    });

    // Bid update (when a bid is accepted)
    socket.on("auction:bid-update", (data) => {
      console.log("Bid update:", data);

      const { vehicles, users } = get();

      // Update vehicle in vehicles array
      const updatedVehicles = vehicles.map(v =>
        v.id === data.vehicle.id ? data.vehicle : v
      );

      // Update user in users array
      const updatedUsers = users.map(u =>
        u.id === data.user.id ? data.user : u
      );

      // Update current vehicle if it's the one that was bid on
      const currentVehicle = get().currentVehicle?.id === data.vehicle.id
        ? data.vehicle
        : get().currentVehicle;

      set({
        vehicles: updatedVehicles,
        users: updatedUsers,
        currentVehicle
      });

      get().addEvent({
        type: "BID_ACCEPTED",
        payload: {
          vehicleId: data.vehicle.id,
          userId: data.user.id,
          amount: data.vehicle.currentBid,
          winner: data.vehicle.winner
        },
        timestamp: data.timestamp
      });
    });

    // Vehicle advance (moving to next vehicle after sale)
    socket.on("auction:vehicle-advance", (data) => {
      console.log("Vehicle advance:", data);

      set({
        currentVehicle: data.currentVehicle,
        currentVehicleIndex: data.currentVehicleIndex
      });

      get().addEvent({
        type: "VEHICLE_ADVANCE",
        payload: {
          vehicleId: data.currentVehicle?.id,
          index: data.currentVehicleIndex
        },
        timestamp: data.timestamp
      });
    });

    // Auction ended (no more vehicles)
    socket.on("auction:ended", (data) => {
      console.log("Auction ended");

      set({ state: "ENDED" });

      get().addEvent({
        type: "AUCTION_ENDED",
        payload: {},
        timestamp: data.timestamp
      });
    });
  },

  // Place a bid via REST API
  placeBid: async (userId, amount) => {
    console.log(`[Store] Placing bid: userId=${userId}, amount=${amount}`);
    try {
      const response = await fetch(`${API_URL}/bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId, amount })
      });

      console.log(`[Store] Response status: ${response.status}`);
      const result = await response.json();
      console.log(`[Store] Response data:`, result);

      if (!result.accepted) {
        get().addEvent({
          type: "BID_REJECTED",
          payload: {
            userId,
            amount,
            reason: result.reason || result.error
          },
          timestamp: Date.now()
        });
      }

      return result;
    } catch (error) {
      console.error("[Store] Bid error:", error);
      get().addEvent({
        type: "BID_ERROR",
        payload: {
          userId,
          amount,
          error: error.message
        },
        timestamp: Date.now()
      });
      return { accepted: false, error: error.message };
    }
  },

  // Add event to log (for debugging UI)
  addEvent: (event) => {
    set((state) => ({
      events: [event, ...state.events].slice(0, 20) // Keep last 20 events
    }));
  },

  // Helper to get user by ID
  getUser: (userId) => {
    return get().users.find(u => u.id === userId);
  }
}));
