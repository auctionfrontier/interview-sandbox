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
    bids: [],
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
    bids: [],
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
    bids: [],
  }
];

/**
 * In-memory store holding the auction state.
 * Represents one customer with one event containing multiple vehicles.
 */
class MockAuctionStore {
  constructor(users = seedUsers, vehicles = seedVehicles) {
    this.customerId = "cust-1";
    this.eventId = "event-1";
    this.users = users;
    this.vehicles = vehicles;
    this.currentVehicleIndex = 0;
    this.state = AuctionState.LIVE;

    // Set first vehicle as active
    if (this.vehicles.length > 0) {
      this.vehicles[0].state = VehicleState.ACTIVE;
    }
  }

  /**
   * Get current active vehicle
   * @returns {object|null}
   */
  getCurrentVehicle() {
    return this.vehicles[this.currentVehicleIndex] || null;
  }

  /**
   * Get user by ID
   * @param {string} userId
   * @returns {object|null}
   */
  getUser(userId) {
    return this.users.find(u => u.id === userId) || null;
  }

  /**
   * Check if user has sufficient credit for bid amount
   * @param {string} userId
   * @param {number} amount
   * @returns {boolean}
   */
  hasCredit(userId, amount) {
    const user = this.getUser(userId);
    if (!user) return false;

    const availableCredit = user.creditLimit - user.creditUsed;
    return availableCredit >= amount;
  }

  /**
   * Update user's credit used
   * @param {string} userId
   * @param {number} previousBid - the user's previous bid amount to release
   * @param {number} newBid - the new bid amount to reserve
   */
  updateUserCredit(userId, previousBid, newBid) {
    const user = this.getUser(userId);
    if (!user) return;

    // Release previous bid credit and reserve new bid credit
    user.creditUsed = user.creditUsed - previousBid + newBid;
  }

  /**
   * Advance to the next vehicle after a 10-second delay
   * @returns {boolean} true if advanced, false if no more vehicles
   */
  advanceToNextVehicle() {
    if (this.currentVehicleIndex >= this.vehicles.length - 1) {
      this.state = AuctionState.ENDED;
      return false;
    }

    // Mark current vehicle as complete
    const currentVehicle = this.getCurrentVehicle();
    if (currentVehicle) {
      currentVehicle.state = VehicleState.SOLD;
    }

    // Move to next vehicle
    this.currentVehicleIndex++;
    const nextVehicle = this.getCurrentVehicle();
    if (nextVehicle) {
      nextVehicle.state = VehicleState.ACTIVE;
    }

    return true;
  }

  /**
   * Returns a serializable snapshot for client hydration
   * @returns {object}
   */
  getSnapshot() {
    return {
      customerId: this.customerId,
      eventId: this.eventId,
      state: this.state,
      users: this.users.map(u => ({
        id: u.id,
        badge: u.badge,
        name: u.name,
        creditLimit: u.creditLimit,
        creditUsed: u.creditUsed,
        availableCredit: u.creditLimit - u.creditUsed
      })),
      vehicles: this.vehicles,
      currentVehicleIndex: this.currentVehicleIndex,
      currentVehicle: this.getCurrentVehicle()
    };
  }
}

module.exports = { MockAuctionStore };
