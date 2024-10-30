const RATE_LIMIT = 5; // Max requests per time frame
const TIME_FRAME = 60000; // Time frame in milliseconds (1 minute)

const userRequests = new Map(); // Store user request counts and timestamps

const checkRateLimit = (userId) => {
    if (!userRequests.has(userId)) {
        userRequests.set(userId, { count: 0, firstRequestTime: Date.now() });
    }

    const userData = userRequests.get(userId);

    // Check if the time frame has passed
    if (Date.now() - userData.firstRequestTime > TIME_FRAME) {
        userData.count = 0; // Reset count if time frame has passed
        userData.firstRequestTime = Date.now();
    }

    // Increment the request count
    userData.count++;

    // Check if the user has exceeded the rate limit
    return userData.count <= RATE_LIMIT;
};

module.exports = { checkRateLimit };