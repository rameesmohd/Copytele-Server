const cron = require("node-cron");
const { handleInterval } = require('../controllers/intervalController')

// // Schedule job for every Saturday at 23:59 UTC
cron.schedule("59 23 * * 6", async () => {
    console.log("Executing handleInterval at:", new Date().toISOString());
    try {
        await handleInterval();
        console.log("handleInterval executed successfully");
    } catch (error) {
        console.error("Error in handleInterval:", error);
    }
}, {
    timezone: "UTC"
});