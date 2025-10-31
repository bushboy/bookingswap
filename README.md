# Booking Swap Platform

A decentralized booking swap platform built on Hedera blockchain that enables secure peer-to-peer booking exchanges.

## Project Structure

This is a monorepo containing:

- `apps/backend` - Node.js/Express API server
- `apps/frontend` - React frontend application
- `packages/shared` - Shared types and utilities

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL database
- Redis cache

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

3. Start development servers:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build all packages
- `npm run test` - Run tests across all packages
- `npm run lint` - Lint all packages
- `npm run format` - Format code with Prettier

## Development

The project uses:

- TypeScript for type safety
- ESLint + Prettier for code formatting
- Husky for Git hooks
- Vitest for testing
- Workspaces for monorepo management

## Key Features

### Personal Booking Management
The My Bookings page uses a simplified status-based filtering approach optimized for personal booking management rather than browsing. This design focuses on booking lifecycle stages (active, with swaps, completed, expired) instead of complex search filters, providing a cleaner mobile experience and reduced cognitive load.

See `apps/frontend/src/components/booking/FILTERING_APPROACH.md` for detailed architecture documentation.
