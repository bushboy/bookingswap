import { AppDispatch } from '../store';
import {
  updateAuction,
  addProposal,
  updateProposal,
  handleAuctionEnd,
  updateAuctionTimeRemaining,
  addActiveConnection,
  removeActiveConnection,
  setError,
} from '../store/slices/auctionSlice';
import { SwapAuction, AuctionProposal } from '@booking-swap/shared';

interface WebSocketMessage {
  type:
    | 'auction_updated'
    | 'proposal_added'
    | 'proposal_updated'
    | 'auction_ended'
    | 'time_update'
    | 'error';
  data: any;
}

interface AuctionWebSocketConnection {
  socket: WebSocket;
  auctionId: string;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  isConnected: boolean;
}

class AuctionWebSocketService {
  private connections: Map<string, AuctionWebSocketConnection> = new Map();
  private dispatch: AppDispatch | null = null;
  private baseUrl: string;

  constructor() {
    // Determine WebSocket URL based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host =
      process.env.NODE_ENV === 'production'
        ? window.location.host
        : 'localhost:3001'; // Backend WebSocket port

    this.baseUrl = `${protocol}//${host}/ws`;
  }

  setDispatch(dispatch: AppDispatch) {
    this.dispatch = dispatch;
  }

  /**
   * Connect to auction updates for a specific auction
   */
  connectToAuction(auctionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connections.has(auctionId)) {
        // Already connected
        resolve();
        return;
      }

      if (!this.dispatch) {
        reject(new Error('Dispatch not set'));
        return;
      }

      try {
        const socket = new WebSocket(`${this.baseUrl}/auctions/${auctionId}`);

        const connection: AuctionWebSocketConnection = {
          socket,
          auctionId,
          reconnectAttempts: 0,
          maxReconnectAttempts: 5,
          reconnectDelay: 1000,
          isConnected: false,
        };

        socket.onopen = () => {
          console.log(`Connected to auction ${auctionId} WebSocket`);
          connection.isConnected = true;
          connection.reconnectAttempts = 0;
          this.dispatch!(addActiveConnection(auctionId));
          resolve();
        };

        socket.onmessage = event => {
          this.handleMessage(event.data, auctionId);
        };

        socket.onclose = event => {
          console.log(
            `Disconnected from auction ${auctionId} WebSocket`,
            event
          );
          connection.isConnected = false;
          this.dispatch!(removeActiveConnection(auctionId));

          // Attempt to reconnect if not a clean close
          if (
            event.code !== 1000 &&
            connection.reconnectAttempts < connection.maxReconnectAttempts
          ) {
            this.attemptReconnect(auctionId);
          } else {
            this.connections.delete(auctionId);
          }
        };

        socket.onerror = error => {
          console.error(`WebSocket error for auction ${auctionId}:`, error);
          this.dispatch!(
            setError(`WebSocket connection error for auction ${auctionId}`)
          );
          reject(error);
        };

        this.connections.set(auctionId, connection);
      } catch (error) {
        console.error(
          `Failed to create WebSocket connection for auction ${auctionId}:`,
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Disconnect from auction updates
   */
  disconnectFromAuction(auctionId: string): void {
    const connection = this.connections.get(auctionId);
    if (connection) {
      connection.socket.close(1000, 'Client disconnect');
      this.connections.delete(auctionId);

      if (this.dispatch) {
        this.dispatch(removeActiveConnection(auctionId));
      }
    }
  }

  /**
   * Disconnect from all auctions
   */
  disconnectAll(): void {
    for (const [auctionId] of this.connections) {
      this.disconnectFromAuction(auctionId);
    }
  }

  /**
   * Check if connected to a specific auction
   */
  isConnectedToAuction(auctionId: string): boolean {
    const connection = this.connections.get(auctionId);
    return connection ? connection.isConnected : false;
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): string[] {
    return Array.from(this.connections.keys()).filter(auctionId =>
      this.isConnectedToAuction(auctionId)
    );
  }

  /**
   * Send a message to a specific auction WebSocket
   */
  sendMessage(auctionId: string, message: any): void {
    const connection = this.connections.get(auctionId);
    if (connection && connection.isConnected) {
      connection.socket.send(JSON.stringify(message));
    } else {
      console.warn(
        `Cannot send message to auction ${auctionId}: not connected`
      );
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string, auctionId: string): void {
    if (!this.dispatch) {
      console.error('Dispatch not available for handling WebSocket message');
      return;
    }

    try {
      const message: WebSocketMessage = JSON.parse(data);

      switch (message.type) {
        case 'auction_updated':
          this.handleAuctionUpdated(message.data);
          break;

        case 'proposal_added':
          this.handleProposalAdded(message.data);
          break;

        case 'proposal_updated':
          this.handleProposalUpdated(message.data);
          break;

        case 'auction_ended':
          this.handleAuctionEnded(message.data);
          break;

        case 'time_update':
          this.handleTimeUpdate(message.data);
          break;

        case 'error':
          this.handleError(message.data, auctionId);
          break;

        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle auction updated message
   */
  private handleAuctionUpdated(auction: SwapAuction): void {
    this.dispatch!(updateAuction(auction));
  }

  /**
   * Handle proposal added message
   */
  private handleProposalAdded(proposal: AuctionProposal): void {
    this.dispatch!(addProposal(proposal));
  }

  /**
   * Handle proposal updated message
   */
  private handleProposalUpdated(proposal: AuctionProposal): void {
    this.dispatch!(updateProposal(proposal));
  }

  /**
   * Handle auction ended message
   */
  private handleAuctionEnded(data: {
    auctionId: string;
    winningProposalId?: string;
  }): void {
    this.dispatch!(handleAuctionEnd(data));

    // Disconnect from this auction as it's ended
    this.disconnectFromAuction(data.auctionId);
  }

  /**
   * Handle time update message
   */
  private handleTimeUpdate(data: {
    auctionId: string;
    timeRemaining: number;
  }): void {
    this.dispatch!(updateAuctionTimeRemaining(data));
  }

  /**
   * Handle error message
   */
  private handleError(error: any, auctionId: string): void {
    console.error(`WebSocket error for auction ${auctionId}:`, error);
    this.dispatch!(
      setError(`WebSocket error: ${error.message || 'Unknown error'}`)
    );
  }

  /**
   * Attempt to reconnect to an auction
   */
  private attemptReconnect(auctionId: string): void {
    const connection = this.connections.get(auctionId);
    if (!connection) return;

    connection.reconnectAttempts++;
    const delay =
      connection.reconnectDelay * Math.pow(2, connection.reconnectAttempts - 1); // Exponential backoff

    console.log(
      `Attempting to reconnect to auction ${auctionId} (attempt ${connection.reconnectAttempts}/${connection.maxReconnectAttempts}) in ${delay}ms`
    );

    setTimeout(() => {
      if (connection.reconnectAttempts <= connection.maxReconnectAttempts) {
        // Remove the old connection and create a new one
        this.connections.delete(auctionId);
        this.connectToAuction(auctionId).catch(error => {
          console.error(`Failed to reconnect to auction ${auctionId}:`, error);
        });
      }
    }, delay);
  }

  /**
   * Subscribe to multiple auctions at once
   */
  async connectToMultipleAuctions(auctionIds: string[]): Promise<void> {
    const connectionPromises = auctionIds.map(auctionId =>
      this.connectToAuction(auctionId).catch(error => {
        console.error(`Failed to connect to auction ${auctionId}:`, error);
        return null; // Don't fail the entire batch
      })
    );

    await Promise.all(connectionPromises);
  }

  /**
   * Get connection status for all auctions
   */
  getConnectionStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [auctionId, connection] of this.connections) {
      status[auctionId] = connection.isConnected;
    }
    return status;
  }

  /**
   * Ping all connections to check if they're still alive
   */
  pingConnections(): void {
    for (const [auctionId, connection] of this.connections) {
      if (connection.isConnected) {
        this.sendMessage(auctionId, { type: 'ping', timestamp: Date.now() });
      }
    }
  }

  /**
   * Set up periodic ping to keep connections alive
   */
  startHeartbeat(interval: number = 30000): void {
    setInterval(() => {
      this.pingConnections();
    }, interval);
  }

  /**
   * Handle page visibility changes to manage connections
   */
  handleVisibilityChange(): void {
    if (document.hidden) {
      // Page is hidden, we might want to reduce activity
      console.log('Page hidden, reducing WebSocket activity');
    } else {
      // Page is visible, ensure all connections are active
      console.log('Page visible, checking WebSocket connections');
      for (const [auctionId, connection] of this.connections) {
        if (!connection.isConnected) {
          this.connectToAuction(auctionId).catch(error => {
            console.error(
              `Failed to reconnect to auction ${auctionId} on visibility change:`,
              error
            );
          });
        }
      }
    }
  }

  /**
   * Initialize the service with event listeners
   */
  initialize(dispatch: AppDispatch): void {
    this.setDispatch(dispatch);

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.disconnectAll();
    });

    // Start heartbeat
    this.startHeartbeat();
  }
}

// Export singleton instance
export const auctionWebSocketService = new AuctionWebSocketService();
export default auctionWebSocketService;
