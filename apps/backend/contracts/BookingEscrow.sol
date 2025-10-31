// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title BookingEscrow
 * @dev Smart contract for secure booking swaps with escrow functionality
 * Handles atomic swaps between two parties with booking verification
 */
contract BookingEscrow {
    enum SwapStatus { 
        PENDING, 
        LOCKED, 
        COMPLETED, 
        CANCELLED, 
        DISPUTED 
    }

    struct Booking {
        string bookingId;
        address owner;
        uint256 value;
        string metadata; // IPFS hash containing booking details
        bool isLocked;
    }

    struct Swap {
        string swapId;
        address proposer;
        address acceptor;
        string sourceBookingId;
        string targetBookingId;
        uint256 additionalPayment;
        SwapStatus status;
        uint256 expiresAt;
        uint256 createdAt;
    }

    // State variables
    mapping(string => Booking) public bookings;
    mapping(string => Swap) public swaps;
    mapping(address => uint256) public balances;
    
    address public owner;
    uint256 public platformFee = 25; // 0.25% in basis points
    uint256 public constant BASIS_POINTS = 10000;
    
    // Events
    event BookingRegistered(string indexed bookingId, address indexed owner, uint256 value);
    event SwapProposed(string indexed swapId, address indexed proposer, address indexed acceptor);
    event SwapAccepted(string indexed swapId);
    event SwapCompleted(string indexed swapId);
    event SwapCancelled(string indexed swapId);
    event FundsDeposited(address indexed user, uint256 amount);
    event FundsWithdrawn(address indexed user, uint256 amount);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner can call this function");
        _;
    }

    modifier onlyBookingOwner(string memory bookingId) {
        require(bookings[bookingId].owner == msg.sender, "Only booking owner can call this function");
        _;
    }

    modifier swapExists(string memory swapId) {
        require(bytes(swaps[swapId].swapId).length > 0, "Swap does not exist");
        _;
    }

    modifier swapNotExpired(string memory swapId) {
        require(block.timestamp <= swaps[swapId].expiresAt, "Swap has expired");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Register a booking in the escrow system
     * @param bookingId Unique identifier for the booking
     * @param value Value of the booking in wei
     * @param metadata IPFS hash containing booking details
     */
    function registerBooking(
        string memory bookingId,
        uint256 value,
        string memory metadata
    ) external payable {
        require(bytes(bookingId).length > 0, "Booking ID cannot be empty");
        require(bytes(bookings[bookingId].bookingId).length == 0, "Booking already exists");
        require(value > 0, "Booking value must be greater than 0");
        require(msg.value >= value, "Insufficient payment for booking value");

        bookings[bookingId] = Booking({
            bookingId: bookingId,
            owner: msg.sender,
            value: value,
            metadata: metadata,
            isLocked: false
        });

        // Store excess payment in user balance
        if (msg.value > value) {
            balances[msg.sender] += msg.value - value;
        }

        emit BookingRegistered(bookingId, msg.sender, value);
    }

    /**
     * @dev Propose a swap between two bookings
     * @param swapId Unique identifier for the swap
     * @param sourceBookingId Proposer's booking ID
     * @param targetBookingId Target booking ID
     * @param additionalPayment Additional payment required (if any)
     * @param expirationTime Timestamp when the proposal expires
     */
    function proposeSwap(
        string memory swapId,
        string memory sourceBookingId,
        string memory targetBookingId,
        uint256 additionalPayment,
        uint256 expirationTime
    ) external payable {
        require(bytes(swapId).length > 0, "Swap ID cannot be empty");
        require(bytes(swaps[swapId].swapId).length == 0, "Swap already exists");
        require(bytes(bookings[sourceBookingId].bookingId).length > 0, "Source booking does not exist");
        require(bytes(bookings[targetBookingId].bookingId).length > 0, "Target booking does not exist");
        require(bookings[sourceBookingId].owner == msg.sender, "Not owner of source booking");
        require(!bookings[sourceBookingId].isLocked, "Source booking is locked");
        require(!bookings[targetBookingId].isLocked, "Target booking is locked");
        require(expirationTime > block.timestamp, "Expiration time must be in the future");

        if (additionalPayment > 0) {
            require(msg.value >= additionalPayment, "Insufficient additional payment");
            balances[msg.sender] += msg.value;
        }

        swaps[swapId] = Swap({
            swapId: swapId,
            proposer: msg.sender,
            acceptor: bookings[targetBookingId].owner,
            sourceBookingId: sourceBookingId,
            targetBookingId: targetBookingId,
            additionalPayment: additionalPayment,
            status: SwapStatus.PENDING,
            expiresAt: expirationTime,
            createdAt: block.timestamp
        });

        // Lock both bookings
        bookings[sourceBookingId].isLocked = true;
        bookings[targetBookingId].isLocked = true;

        emit SwapProposed(swapId, msg.sender, bookings[targetBookingId].owner);
    }

    /**
     * @dev Accept a swap proposal
     * @param swapId The swap to accept
     */
    function acceptSwap(string memory swapId) 
        external 
        swapExists(swapId) 
        swapNotExpired(swapId) 
    {
        Swap storage swap = swaps[swapId];
        require(swap.acceptor == msg.sender, "Only acceptor can accept the swap");
        require(swap.status == SwapStatus.PENDING, "Swap is not in pending status");

        swap.status = SwapStatus.LOCKED;
        emit SwapAccepted(swapId);
    }

    /**
     * @dev Execute the swap (complete the atomic exchange)
     * @param swapId The swap to execute
     */
    function executeSwap(string memory swapId) 
        external 
        swapExists(swapId) 
        swapNotExpired(swapId) 
    {
        Swap storage swap = swaps[swapId];
        require(
            swap.proposer == msg.sender || swap.acceptor == msg.sender, 
            "Only swap participants can execute"
        );
        require(swap.status == SwapStatus.LOCKED, "Swap must be locked before execution");

        // Get booking references
        Booking storage sourceBooking = bookings[swap.sourceBookingId];
        Booking storage targetBooking = bookings[swap.targetBookingId];

        // Calculate platform fees
        uint256 sourceFee = (sourceBooking.value * platformFee) / BASIS_POINTS;
        uint256 targetFee = (targetBooking.value * platformFee) / BASIS_POINTS;

        // Swap ownership
        address originalProposer = sourceBooking.owner;
        address originalAcceptor = targetBooking.owner;

        sourceBooking.owner = originalAcceptor;
        targetBooking.owner = originalProposer;

        // Handle additional payment
        if (swap.additionalPayment > 0) {
            require(balances[swap.proposer] >= swap.additionalPayment, "Insufficient balance for additional payment");
            balances[swap.proposer] -= swap.additionalPayment;
            balances[swap.acceptor] += swap.additionalPayment;
        }

        // Deduct platform fees
        balances[owner] += sourceFee + targetFee;

        // Unlock bookings
        sourceBooking.isLocked = false;
        targetBooking.isLocked = false;

        // Update swap status
        swap.status = SwapStatus.COMPLETED;

        emit SwapCompleted(swapId);
    }

    /**
     * @dev Cancel a swap proposal
     * @param swapId The swap to cancel
     */
    function cancelSwap(string memory swapId) external swapExists(swapId) {
        Swap storage swap = swaps[swapId];
        require(
            swap.proposer == msg.sender || 
            swap.acceptor == msg.sender || 
            block.timestamp > swap.expiresAt,
            "Not authorized to cancel or swap not expired"
        );
        require(
            swap.status == SwapStatus.PENDING || swap.status == SwapStatus.LOCKED,
            "Cannot cancel completed or cancelled swap"
        );

        // Unlock bookings
        bookings[swap.sourceBookingId].isLocked = false;
        bookings[swap.targetBookingId].isLocked = false;

        // Refund additional payment if any
        if (swap.additionalPayment > 0 && balances[swap.proposer] >= swap.additionalPayment) {
            balances[swap.proposer] -= swap.additionalPayment;
            // Additional payment refund logic would go here
        }

        swap.status = SwapStatus.CANCELLED;
        emit SwapCancelled(swapId);
    }

    /**
     * @dev Withdraw funds from user balance
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(amount > 0, "Amount must be greater than 0");

        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);

        emit FundsWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Deposit funds to user balance
     */
    function deposit() external payable {
        require(msg.value > 0, "Must send some ether");
        balances[msg.sender] += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Get booking details
     * @param bookingId The booking ID to query
     */
    function getBooking(string memory bookingId) 
        external 
        view 
        returns (
            string memory,
            address,
            uint256,
            string memory,
            bool
        ) 
    {
        Booking memory booking = bookings[bookingId];
        return (
            booking.bookingId,
            booking.owner,
            booking.value,
            booking.metadata,
            booking.isLocked
        );
    }

    /**
     * @dev Get swap details
     * @param swapId The swap ID to query
     */
    function getSwap(string memory swapId)
        external
        view
        returns (
            string memory,
            address,
            address,
            string memory,
            string memory,
            uint256,
            SwapStatus,
            uint256,
            uint256
        )
    {
        Swap memory swap = swaps[swapId];
        return (
            swap.swapId,
            swap.proposer,
            swap.acceptor,
            swap.sourceBookingId,
            swap.targetBookingId,
            swap.additionalPayment,
            swap.status,
            swap.expiresAt,
            swap.createdAt
        );
    }

    /**
     * @dev Update platform fee (only owner)
     * @param newFee New fee in basis points
     */
    function updatePlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 500, "Fee cannot exceed 5%"); // Max 5%
        platformFee = newFee;
    }

    /**
     * @dev Emergency function to pause contract (only owner)
     */
    function emergencyPause() external onlyOwner {
        // Implementation would include pausing functionality
        // This is a placeholder for emergency controls
    }

    /**
     * @dev Get contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Get user balance
     * @param user User address
     */
    function getUserBalance(address user) external view returns (uint256) {
        return balances[user];
    }
}