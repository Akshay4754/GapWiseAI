require("dotenv").config();
const app = require("./src/app");
const connectToDB = require("./src/config/database");

// Only connect to DB and start server if not in test environment
if (process.env.NODE_ENV !== "test") {
  connectToDB();
}

// Export app for testing
module.exports = app;

// Start server only when run directly (not required by tests)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
