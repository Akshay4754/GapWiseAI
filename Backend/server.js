require("dotenv").config();
const app = require("./src/app");
const connectToDB = require("./src/config/database");

// Export app for testing
module.exports = app;

// Start only after MongoDB is available. This prevents API requests from
// reaching Mongoose while it is disconnected and buffering operations.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  connectToDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Unable to start: MongoDB connection failed.", error.message);
      process.exit(1);
    });
}
