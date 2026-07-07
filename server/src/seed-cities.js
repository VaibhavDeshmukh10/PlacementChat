require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Room = require("./models/Room");

async function seedRooms() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    // Clear existing rooms (optional)
    await Room.deleteMany({});
    console.log("🗑️  Cleared existing rooms");

    // Test rooms with cities
    const testRooms = [
      {
        name: "Amazon",
        slug: "amazon",
        domain: "amazon.com",
        cities: ["Bangalore", "Delhi", "Mumbai", "Pune", "Hyderabad"],
        status: "Active",
      },
      {
        name: "Google",
        slug: "google",
        domain: "google.com",
        cities: ["Bangalore", "Mumbai", "Hyderabad"],
        status: "Active",
      },
      {
        name: "Microsoft",
        slug: "microsoft",
        domain: "microsoft.com",
        cities: ["Bangalore", "Delhi", "Pune"],
        status: "Active",
      },
      {
        name: "Apple",
        slug: "apple",
        domain: "apple.com",
        cities: ["Bangalore", "Mumbai"],
        status: "Active",
      },
      {
        name: "Meta",
        slug: "meta",
        domain: "meta.com",
        cities: ["Bangalore", "Pune"],
        status: "Active",
      },
      {
        name: "TCS",
        slug: "tcs",
        domain: "tcs.com",
        cities: ["Bangalore", "Delhi", "Mumbai", "Pune", "Chennai", "Hyderabad"],
        status: "Active",
      },
      {
        name: "Infosys",
        slug: "infosys",
        domain: "infosys.com",
        cities: ["Bangalore", "Delhi", "Pune"],
        status: "Active",
      },
    ];

    // Insert rooms
    const created = await Room.insertMany(testRooms);
    console.log(`✅ Created ${created.length} rooms with cities`);

    // Display created rooms
    console.log("\n📋 Created Rooms:");
    created.forEach((room) => {
      console.log(`  • ${room.name} (${room.cities.length} cities): ${room.cities.join(", ")}`);
    });

    console.log("\n✅ Seed successful!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

seedRooms();
