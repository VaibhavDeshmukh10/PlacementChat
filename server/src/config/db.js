const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer = null;

async function connectDB() {
  try {
    let mongoUri = process.env.MONGO_URI;
    let useLocalMongo = mongoUri && !mongoUri.includes('mongodb+srv');
    
    // Try local MongoDB first if specified
    if (useLocalMongo) {
      console.log("Attempting to connect to local MongoDB...");
      try {
        await mongoose.connect(mongoUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 3000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
          minPoolSize: 2,
          retryWrites: true
        });
        console.log("✅ Local MongoDB connected successfully");
        return;
      } catch (localError) {
        console.warn("⚠️  Local MongoDB connection failed, using in-memory database...");
        console.warn("Tip: Install and start MongoDB locally (mongod) or change MONGO_URI to MongoDB Atlas");
      }
    }
    
    // Try MongoDB Atlas if URI is provided
    if (mongoUri && mongoUri.includes('mongodb+srv')) {
      console.log("Connecting to MongoDB Atlas...");
      try {
        await mongoose.connect(mongoUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
          minPoolSize: 2,
          retryWrites: true
        });
        console.log("✅ MongoDB Atlas connected successfully");
        return;
      } catch (atlasError) {
        console.warn("⚠️  MongoDB Atlas connection failed, using in-memory database...");
        console.warn("Error:", atlasError.message);
        console.warn("Tip: Make sure your IP is whitelisted in MongoDB Atlas");
      }
    }
    
    // Fallback to in-memory MongoDB for development
    console.log("Starting in-memory MongoDB for development...");
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'placementdesk'
      }
    });
    mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri);
    console.log("✅ In-memory MongoDB started for development (data will be lost on restart)");
    
  } catch (err) {
    console.error("❌ Database connection error:", err.message);
    process.exit(1);
  }
}

async function closeDB() {
  try {
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log("Database connection closed");
  } catch (err) {
    console.error("Error closing database:", err.message);
  }
}

module.exports = { connectDB, closeDB };
