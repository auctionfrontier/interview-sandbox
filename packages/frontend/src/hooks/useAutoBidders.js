import { useEffect, useRef } from "react";
import { useAuctionStore } from "../store/auctionStore";

/**
 * Hook that simulates automated bidders (user-2 and user-3)
 * They will randomly bid on the current vehicle to create competition
 */
export const useAutoBidders = () => {
  const { currentVehicle, users, placeBid, connected } = useAuctionStore();
  const timersRef = useRef([]);

  useEffect(() => {
    // Clear any existing timers
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];

    if (!connected || !currentVehicle || currentVehicle.winner) {
      return; // Don't bid if not connected, no vehicle, or vehicle is sold
    }

    // Auto bidders (user-2 and user-3)
    const autoBidders = ["user-2", "user-3"];

    // Schedule random bids for each auto bidder
    autoBidders.forEach((userId) => {
      const scheduleNextBid = () => {
        // Random delay between 3-8 seconds
        const delay = 3000 + Math.random() * 5000;

        const timer = setTimeout(async () => {
          const vehicle = useAuctionStore.getState().currentVehicle;
          const allUsers = useAuctionStore.getState().users;
          const isConnected = useAuctionStore.getState().connected;

          // Don't bid if vehicle is sold or we're disconnected
          if (!vehicle || vehicle.winner || !isConnected) {
            return;
          }

          const user = allUsers.find(u => u.id === userId);
          if (!user) return;

          const currentBid = vehicle.currentBid;

          // Fixed $100 increment
          const nextBid = currentBid + 100;

          // Check if user has enough credit
          if (user.availableCredit < nextBid) {
            console.log(`Auto-bidder ${userId} has insufficient credit`);
            return;
          }

          // 70% chance to bid (makes it more realistic/competitive)
          if (Math.random() < 0.7) {
            console.log(`Auto-bidder ${userId} placing bid: $${nextBid}`);
            await placeBid(userId, nextBid);
          }

          // Schedule next bid
          scheduleNextBid();
        }, delay);

        timersRef.current.push(timer);
      };

      // Start bidding for this auto-bidder
      scheduleNextBid();
    });

    // Cleanup timers on unmount or when vehicle changes
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current = [];
    };
  }, [currentVehicle?.id, connected, currentVehicle?.winner]);

  return null;
};
