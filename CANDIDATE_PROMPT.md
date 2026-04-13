# Interview Sandbox v2

You may use an AI companion during this exercise.

That is intentional.

This exercise is not only about writing code quickly. It is about how you reason when the product and systems contract is incomplete. Some parts of the implementation are intentionally ambiguous. We expect you to ask clarifying questions before and during coding.

## Context

This repo is a simplified auction flow:

- an in-memory data layer
- a Node/Express backend
- a React frontend
- a REST command path for placing bids
- a websocket event path for state updates

The current version introduces:

- async bid processing
- versioned state
- optimistic UI
- out-of-order websocket delivery pressure

## What We Want To Evaluate

- How you identify missing requirements
- How you reason about async behavior in single-threaded JavaScript
- How you make backend and frontend contracts coherent
- How you explain tradeoffs and choose safe defaults
- How you use AI as a tool instead of as a substitute for product/system judgment

## Start Here

Before coding, spend time asking questions.

Do not assume the existing behavior is correct just because code exists.

## Candidate-Facing Seams

Two areas are intentionally incomplete:

1. Backend stale bid policy
   File: `packages/backend/src/auctionEngine.js`

   The server receives `expectedVersion`, but the engine does not define what should happen when the client bid was generated against an older vehicle version.

   Questions you may want to ask:
   - Should stale bids always be rejected?
   - Should the server re-evaluate them against current state?
   - Should the response carry special metadata for the client?

2. Frontend event reconciliation
   File: `packages/frontend/src/store/auctionStore.js`

   The websocket merge path is intentionally naive. Late or out-of-order events can overwrite a newer local or server-confirmed state.

   Questions you may want to ask:
   - Which source of truth wins when REST and websocket disagree?
   - How should optimistic state be represented?
   - When should the client ignore stale events?
   - How should the UI recover after a rejected optimistic bid?

## Deliverable

Make the system behavior more coherent across backend and frontend.

At minimum:

- choose and implement a stale bid policy
- make the frontend reconciliation behavior match that policy
- keep the user experience understandable when bids race or arrive out of order

Be prepared to explain:

- what assumptions you made
- what questions you asked
- what tradeoffs you chose
- what you would do next with more time

## Notes

- You may change backend code, frontend code, and tests.
- You do not need to perfectly solve every edge case.
- A smaller, well-reasoned solution is better than a larger, fragile one.
