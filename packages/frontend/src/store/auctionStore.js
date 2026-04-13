import { create } from "zustand";
import { io } from "socket.io-client";

const DEFAULT_WS_URL = "http://localhost:3000";
const API_URL = "http://localhost:3000";

let socket = null;

const createRequestId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `bid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const cloneUser = (user) => ({ ...user });

const cloneVehicle = (vehicle) => ({
  ...vehicle,
  bids: (vehicle?.bids || []).map((bid) => ({ ...bid }))
});

const buildSnapshotState = (snapshot) => ({
  customerId: snapshot.customerId,
  eventId: snapshot.eventId,
  state: snapshot.state,
  snapshotVersion: snapshot.snapshotVersion ?? 0,
  users: (snapshot.users || []).map(cloneUser),
  vehicles: (snapshot.vehicles || []).map(cloneVehicle),
  currentVehicleIndex: snapshot.currentVehicleIndex ?? 0,
  currentVehicle: snapshot.currentVehicle ? cloneVehicle(snapshot.currentVehicle) : null
});

const shouldReplaceVehicle = (currentVehicle, incomingVehicle) => {
  // TODO(candidate): decide how websocket events should reconcile with
  // optimistic local state and out-of-order delivery. This naive merge keeps
  // the repo runnable, but it will happily let an older event overwrite a
  // newer optimistic or authoritative view.
  void currentVehicle;
  void incomingVehicle;
  return true;
};

const mergeUsers = (existingUsers, incomingUsers = []) => {
  const order = existingUsers.map((user) => user.id);
  const usersById = new Map(existingUsers.map((user) => [user.id, cloneUser(user)]));

  incomingUsers.forEach((user) => {
    if (!usersById.has(user.id)) {
      order.push(user.id);
    }
    usersById.set(user.id, cloneUser(user));
  });

  return order.map((id) => usersById.get(id)).filter(Boolean);
};

const mergeVehicle = (vehicles, incomingVehicle) => {
  let replaced = false;
  const nextVehicle = { ...cloneVehicle(incomingVehicle), optimistic: false, pendingRequestId: null };

  const nextVehicles = vehicles.map((vehicle) => {
    if (vehicle.id !== nextVehicle.id) {
      return vehicle;
    }

    replaced = true;
    return shouldReplaceVehicle(vehicle, nextVehicle) ? nextVehicle : vehicle;
  });

  return replaced ? nextVehicles : [...nextVehicles, nextVehicle];
};

const applyOptimisticCredit = (users, vehicle, userId, amount) => {
  const nextUsers = users.map(cloneUser);
  const previousWinnerId = vehicle.currentWinner;
  const previousWinningBid = previousWinnerId ? vehicle.currentBid : 0;

  if (previousWinnerId && previousWinnerId !== userId) {
    const previousWinner = nextUsers.find((user) => user.id === previousWinnerId);
    if (previousWinner) {
      previousWinner.creditUsed = Math.max(0, previousWinner.creditUsed - previousWinningBid);
    }
  }

  const biddingUser = nextUsers.find((user) => user.id === userId);
  if (biddingUser) {
    const previousExposure = previousWinnerId === userId ? vehicle.currentBid : 0;
    biddingUser.creditUsed = Math.max(0, biddingUser.creditUsed - previousExposure + amount);
  }

  return nextUsers.map((user) => ({
    ...user,
    availableCredit: user.creditLimit - user.creditUsed
  }));
};

const createEvent = (type, payload, timestamp = Date.now()) => ({
  type,
  payload,
  timestamp
});

export const useAuctionStore = create((set, get) => ({
  customerId: null,
  eventId: null,
  state: "LIVE",
  users: [],
  vehicles: [],
  currentVehicleIndex: 0,
  currentVehicle: null,
  snapshotVersion: 0,
  connected: false,
  syncStatus: "idle",
  pendingBid: null,
  lastError: null,
  events: [],

  addEvent: (event) => {
    set((state) => ({
      events: [event, ...state.events].slice(0, 20)
    }));
  },

  applySnapshot: (snapshot, source = "snapshot") => {
    if (!snapshot) return false;

    let applied = false;

    set((state) => {
      if ((snapshot.snapshotVersion ?? 0) < state.snapshotVersion) {
        return state;
      }

      applied = true;
      return {
        ...buildSnapshotState(snapshot),
        syncStatus: state.pendingBid ? "pending" : "live",
        pendingBid: state.pendingBid,
        lastError: null,
        events: state.events
      };
    });

    if (applied) {
      get().addEvent(
        createEvent("SNAPSHOT_APPLIED", {
          source,
          snapshotVersion: snapshot.snapshotVersion
        })
      );
    }

    return applied;
  },

  fetchSnapshot: async (reason = "manual") => {
    set((state) => ({
      syncStatus: state.pendingBid ? "pending" : "syncing"
    }));

    try {
      const response = await fetch(`${API_URL}/auction`);
      if (!response.ok) {
        throw new Error(`Snapshot request failed with ${response.status}`);
      }

      const snapshot = await response.json();
      get().applySnapshot(snapshot, `rest:${reason}`);
      return snapshot;
    } catch (error) {
      set({
        syncStatus: "error",
        lastError: error.message
      });
      get().addEvent(
        createEvent("SNAPSHOT_ERROR", {
          reason,
          error: error.message
        })
      );
      throw error;
    }
  },

  initSocket: () => {
    if (socket) return;

    socket = io(DEFAULT_WS_URL, {
      transports: ["websocket"]
    });

    socket.on("connect", () => {
      set({ connected: true, syncStatus: "syncing" });
      get().addEvent(createEvent("SOCKET_CONNECTED", {}));
      get().fetchSnapshot("connect").catch(() => {});
    });

    socket.on("disconnect", () => {
      set({ connected: false, syncStatus: "offline" });
      get().addEvent(createEvent("SOCKET_DISCONNECTED", {}));
    });

    socket.on("auction:snapshot", (snapshot) => {
      get().applySnapshot(snapshot, "socket:init");
    });

    socket.on("auction:bid-update", (data) => {
      let applied = false;

      set((state) => {
        const mergedVehicle = { ...cloneVehicle(data.vehicle), optimistic: false, pendingRequestId: null };
        const currentVehicle = state.currentVehicle?.id === mergedVehicle.id
          ? state.currentVehicle
          : state.vehicles.find((vehicle) => vehicle.id === mergedVehicle.id);

        if (!shouldReplaceVehicle(currentVehicle, mergedVehicle)) {
          return state;
        }

        applied = true;
        const vehicles = mergeVehicle(state.vehicles, mergedVehicle);
        const users = mergeUsers(state.users, data.users || []);
        const pendingBid = state.pendingBid?.requestId === data.requestId ? null : state.pendingBid;

        return {
          vehicles,
          users,
          currentVehicle: state.currentVehicle?.id === mergedVehicle.id
            ? mergedVehicle
            : state.currentVehicle,
          snapshotVersion: Math.max(state.snapshotVersion, data.snapshotVersion ?? state.snapshotVersion),
          pendingBid,
          syncStatus: pendingBid ? "pending" : "live",
          lastError: state.lastError
        };
      });

      get().addEvent(
        createEvent(applied ? "BID_STREAM_APPLIED" : "BID_STREAM_IGNORED", {
          requestId: data.requestId,
          vehicleId: data.vehicle?.id,
          version: data.vehicle?.version,
          snapshotVersion: data.snapshotVersion
        }, data.timestamp)
      );
    });

    socket.on("auction:vehicle-advance", (data) => {
      get().applySnapshot(data.snapshot, "socket:vehicle-advance");
    });

    socket.on("auction:ended", (data) => {
      get().applySnapshot(data.snapshot, "socket:ended");
    });
  },

  placeBid: async (userId, amount, options = {}) => {
    const state = get();
    const currentVehicle = state.currentVehicle;
    const optimistic = options.optimistic !== false;

    if (!currentVehicle) {
      return { accepted: false, error: "No active vehicle." };
    }

    if (optimistic && state.pendingBid) {
      return { accepted: false, error: "A bid is already pending." };
    }

    const requestId = createRequestId();
    const rollback = optimistic
      ? {
          users: state.users.map(cloneUser),
          vehicles: state.vehicles.map(cloneVehicle),
          currentVehicle: currentVehicle ? cloneVehicle(currentVehicle) : null,
          snapshotVersion: state.snapshotVersion
        }
      : null;

    if (optimistic) {
      const optimisticVehicle = {
        ...cloneVehicle(currentVehicle),
        currentBid: amount,
        currentWinner: userId,
        optimistic: true,
        pendingRequestId: requestId,
        version: (currentVehicle.version ?? 0) + 1
      };
      const optimisticUsers = applyOptimisticCredit(state.users, currentVehicle, userId, amount);

      set({
        users: optimisticUsers,
        vehicles: mergeVehicle(state.vehicles, optimisticVehicle),
        currentVehicle: optimisticVehicle,
        pendingBid: {
          requestId,
          userId,
          amount,
          vehicleId: currentVehicle.id,
          startedAt: Date.now(),
          rollback
        },
        syncStatus: "pending",
        lastError: null
      });
    }

    get().addEvent(
      createEvent(optimistic ? "BID_PENDING" : "BID_SUBMITTED", {
        requestId,
        userId,
        amount,
        vehicleId: currentVehicle.id,
        expectedVersion: currentVehicle.version
      })
    );

    try {
      const response = await fetch(`${API_URL}/bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          amount,
          requestId,
          expectedVersion: currentVehicle.version
        })
      });

      const result = await response.json();

      if (result.snapshot) {
        get().applySnapshot(result.snapshot, result.accepted ? "rest:bid-accepted" : "rest:bid-rejected");
      }

      if (optimistic) {
        set((latestState) => ({
          pendingBid: latestState.pendingBid?.requestId === requestId ? null : latestState.pendingBid,
          syncStatus: latestState.pendingBid?.requestId === requestId ? "live" : latestState.syncStatus,
          lastError: result.accepted ? null : result.reason || result.error || latestState.lastError
        }));
      } else if (!result.accepted) {
        set((latestState) => ({
          lastError: result.reason || result.error || latestState.lastError
        }));
      }

      get().addEvent(
        createEvent(result.accepted ? "BID_CONFIRMED" : "BID_REJECTED", {
          requestId,
          userId,
          amount,
          vehicleId: currentVehicle.id,
          reason: result.reason || result.error || null
        })
      );

      return result;
    } catch (error) {
      set((latestState) => {
        const pendingBid = latestState.pendingBid;
        if (!optimistic || !pendingBid || pendingBid.requestId !== requestId) {
          return {
            syncStatus: "error",
            lastError: error.message
          };
        }

        return {
          users: pendingBid.rollback.users,
          vehicles: pendingBid.rollback.vehicles,
          currentVehicle: pendingBid.rollback.currentVehicle,
          snapshotVersion: pendingBid.rollback.snapshotVersion,
          pendingBid: null,
          syncStatus: "error",
          lastError: error.message
        };
      });

      get().addEvent(
        createEvent("BID_ERROR", {
          requestId,
          userId,
          amount,
          error: error.message
        })
      );

      get().fetchSnapshot("bid-error-recovery").catch(() => {});
      return { accepted: false, error: error.message, requestId };
    }
  },

  getUser: (userId) => get().users.find((user) => user.id === userId)
}));
