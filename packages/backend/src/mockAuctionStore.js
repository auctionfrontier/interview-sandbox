const { AuctionState, VehicleState } = require("./models");

/**
 * Seed users - all belong to the same customer and event
 */
const seedUsers = [
  {
    id: "user-1",
    badge: "lane-7",
    name: "James Seebach",
    creditLimit: 50000,
    creditUsed: 0
  },
  {
    id: "user-2",
    badge: "lane-12",
    name: "Sarah Smith",
    creditLimit: 40000,
    creditUsed: 0
  },
  {
    id: "user-3",
    badge: "remote-44",
    name: "Mike Johnson",
    creditLimit: 60000,
    creditUsed: 0
  }
];

/**
 * Seed vehicles - all belong to the same auction event
 */
const seedVehicles = [
  {
    id: "veh-001",
    year: 2019,
    make: "Toyota",
    model: "Camry",
    vin: "1A2B3C4D5E6F7G8H9",
    startingBid: 8500,
    targetPrice: 11000,
    currentBid: 8500,
    currentWinner: null,
    winner: null,
    soldAt: null,
    state: VehicleState.PENDING,
    version: 1,
    updatedAt: null,
    bids: []
  },
  {
    id: "veh-002",
    year: 2021,
    make: "Ford",
    model: "F-150",
    vin: "9H8G7F6E5D4C3B2A1",
    startingBid: 15000,
    targetPrice: 18500,
    currentBid: 15000,
    currentWinner: null,
    winner: null,
    soldAt: null,
    state: VehicleState.PENDING,
    version: 1,
    updatedAt: null,
    bids: []
  },
  {
    id: "veh-003",
    year: 2018,
    make: "Honda",
    model: "Civic",
    vin: "2C3D4E5F6G7H8I9J0",
    startingBid: 6000,
    targetPrice: 8500,
    currentBid: 6000,
    currentWinner: null,
    winner: null,
    soldAt: null,
    state: VehicleState.PENDING,
    version: 1,
    updatedAt: null,
    bids: []
  }
];

const cloneUser = (user) => ({
  id: user.id,
  badge: user.badge,
  name: user.name,
  creditLimit: user.creditLimit,
  creditUsed: user.creditUsed
});

const cloneVehicle = (vehicle) => ({
  id: vehicle.id,
  year: vehicle.year,
  make: vehicle.make,
  model: vehicle.model,
  vin: vehicle.vin,
  startingBid: vehicle.startingBid,
  targetPrice: vehicle.targetPrice,
  currentBid: vehicle.currentBid,
  currentWinner: vehicle.currentWinner,
  winner: vehicle.winner,
  soldAt: vehicle.soldAt,
  state: vehicle.state,
  version: vehicle.version,
  updatedAt: vehicle.updatedAt,
  bids: (vehicle.bids || []).map((bid) => ({ ...bid }))
});

const createUserSnapshot = (user) => ({
  ...cloneUser(user),
  availableCredit: user.creditLimit - user.creditUsed
});

/**
 * In-memory store holding the auction state.
 * Represents one customer with one event containing multiple vehicles.
 */
class MockAuctionStore {
  constructor(users = seedUsers, vehicles = seedVehicles) {
    this.customerId = "cust-1";
    this.eventId = "event-1";
    this.users = users.map(cloneUser);
    this.vehicles = vehicles.map(cloneVehicle);
    this.currentVehicleIndex = 0;
    this.state = AuctionState.LIVE;
    this.snapshotVersion = 1;

    // Set first vehicle as active
    if (this.vehicles.length > 0) {
      this.vehicles[0].state = VehicleState.ACTIVE;
      this.vehicles[0].updatedAt = Date.now();
    }
  }

  getCurrentVehicle() {
    return this.vehicles[this.currentVehicleIndex] || null;
  }

  getUser(userId) {
    return this.users.find((user) => user.id === userId) || null;
  }

  getUserSnapshot(userId) {
    const user = this.getUser(userId);
    return user ? createUserSnapshot(user) : null;
  }

  getVehicleSnapshot(vehicleId) {
    const vehicle = this.vehicles.find((item) => item.id === vehicleId);
    return vehicle ? cloneVehicle(vehicle) : null;
  }

  hasCredit(userId, amount) {
    const user = this.getUser(userId);
    if (!user) return false;

    const availableCredit = user.creditLimit - user.creditUsed;
    return availableCredit >= amount;
  }

  updateUserCredit(userId, previousBid, newBid) {
    const user = this.getUser(userId);
    if (!user) return null;

    user.creditUsed = Math.max(0, user.creditUsed - previousBid + newBid);
    return createUserSnapshot(user);
  }

  recordBid(vehicleId, bid) {
    const vehicle = this.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return null;

    vehicle.bids.push({ ...bid });
    return cloneVehicle(vehicle);
  }

  markVehicleUpdated(vehicle, timestamp = Date.now()) {
    vehicle.version += 1;
    vehicle.updatedAt = timestamp;
    this.snapshotVersion += 1;
    return cloneVehicle(vehicle);
  }

  advanceToNextVehicle() {
    const currentVehicle = this.getCurrentVehicle();
    if (!currentVehicle) {
      return { advanced: false, currentVehicle: null, snapshot: this.getSnapshot() };
    }

    if (this.currentVehicleIndex >= this.vehicles.length - 1) {
      this.state = AuctionState.ENDED;
      this.snapshotVersion += 1;
      return {
        advanced: false,
        currentVehicle: null,
        snapshot: this.getSnapshot()
      };
    }

    currentVehicle.state = VehicleState.SOLD;
    this.currentVehicleIndex += 1;

    const nextVehicle = this.getCurrentVehicle();
    if (nextVehicle) {
      nextVehicle.state = VehicleState.ACTIVE;
      this.markVehicleUpdated(nextVehicle);
    } else {
      this.snapshotVersion += 1;
    }

    return {
      advanced: true,
      currentVehicle: nextVehicle ? cloneVehicle(nextVehicle) : null,
      snapshot: this.getSnapshot()
    };
  }

  getSnapshot() {
    return {
      customerId: this.customerId,
      eventId: this.eventId,
      state: this.state,
      snapshotVersion: this.snapshotVersion,
      users: this.users.map(createUserSnapshot),
      vehicles: this.vehicles.map(cloneVehicle),
      currentVehicleIndex: this.currentVehicleIndex,
      currentVehicle: this.getCurrentVehicle() ? cloneVehicle(this.getCurrentVehicle()) : null
    };
  }
}

module.exports = { MockAuctionStore };
