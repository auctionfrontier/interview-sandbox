const { AuctionState } = require("./models");

/** @type {Array<{id: string, year: number, make: string, model: string, vin: string, startingBid: number, reservePrice?: number}>} */
const seedVehicles = [
  {
    id: "veh-001",
    year: 2019,
    make: "Toyota",
    model: "Camry",
    vin: "1A2B3C4D5E6F7G8H9",
    startingBid: 8500,
    reservePrice: 11000
  },
  {
    id: "veh-002",
    year: 2021,
    make: "Ford",
    model: "F-150",
    vin: "9H8G7F6E5D4C3B2A1",
    startingBid: 15000,
    reservePrice: 18500
  },
  {
    id: "veh-003",
    year: 2018,
    make: "Honda",
    model: "Civic",
    vin: "2C3D4E5F6G7H8I9J0",
    startingBid: 6000
  }
];

/**
 * In-memory store holding the auction snapshot used by the mock engine.
 */
class MockAuctionStore {
  /**
   * @param {Array<{id: string, year: number, make: string, model: string, vin: string, startingBid: number, reservePrice?: number}>} [vehicles]
   */
  constructor(vehicles = seedVehicles) {
    this.vehicles = vehicles;
    this.state = AuctionState.LIVE;
    this.currentVehicleId = vehicles[0]?.id ?? "";
    this.highestBids = Object.fromEntries(
      vehicles.map((vehicle) => [vehicle.id, null])
    );
  }

  /**
   * Returns a serializable snapshot for initial client hydration.
   * @returns {{vehicles: typeof this.vehicles, state: string, currentVehicleId: string, highestBids: Record<string, object|null>}}
   */
  getSnapshot() {
    return {
      vehicles: this.vehicles,
      state: this.state,
      currentVehicleId: this.currentVehicleId,
      highestBids: this.highestBids
    };
  }
}

module.exports = { MockAuctionStore };
