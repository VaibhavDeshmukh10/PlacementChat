require("dotenv").config();
const mongoose = require("mongoose");
const Room = require("./models/Room");
const Feedback = require("./models/Feedback");
const User = require("./models/User");
const Message = require("./models/Message");

const ROOMS = [
  { name: "TCS", slug: "tcs", domain: "tcs.com", cities: ["Pune", "Chennai", "Kolkata"], memberCount: 812 },
  { name: "Infosys", slug: "infosys", domain: "infosys.com", cities: ["Mysuru", "Pune", "Bhubaneswar"], memberCount: 645 },
  { name: "Wipro", slug: "wipro", domain: "wipro.com", cities: ["Bengaluru", "Hyderabad"], memberCount: 390 },
  { name: "Amazon", slug: "amazon", domain: "amazon.com", cities: ["Hyderabad", "Bengaluru", "Chennai"], memberCount: 1102 },
  { name: "Google", slug: "google", domain: "google.com", cities: ["Bengaluru", "Gurugram"], memberCount: 530 },
  { name: "Microsoft", slug: "microsoft", domain: "microsoft.com", cities: ["Hyderabad", "Noida"], memberCount: 474 },
  { name: "Accenture", slug: "accenture", domain: "accenture.com", cities: ["Pune", "Mumbai", "Indore"], memberCount: 601 },
  { name: "Deloitte USI", slug: "deloitte", domain: "deloitte.com", cities: ["Hyderabad", "Gurugram"], memberCount: 298 },
  { name: "Cognizant", slug: "cognizant", domain: "cognizant.com", cities: ["Pune", "Chennai", "Kolkata"], memberCount: 377 },
  { name: "Capgemini", slug: "capgemini", domain: "capgemini.com", cities: ["Mumbai", "Bengaluru"], memberCount: 265 },
  { name: "HCLTech", slug: "hcltech", domain: "hcltech.com", cities: ["Noida", "Chennai"], memberCount: 214 },
  { name: "Tech Mahindra", slug: "techmahindra", domain: "techmahindra.com", cities: ["Pune", "Hyderabad"], memberCount: 188 },
];

const DEMO_USERS = [
  {
    name: "Demo Admin",
    email: "demo-admin@placementdesk.app",
    provider: "dev",
    providerId: "demo-admin@placementdesk.app",
    role: "admin",
    avatar: "https://ui-avatars.com/api/?name=Demo+Admin&background=dc2626&color=fff",
    college: "PlacementDesk University",
    city: "Mumbai",
    branch: "Computer Science",
    batchYear: 2024
  },
  {
    name: "Rahul Sharma",
    email: "rahul.sharma@student.edu",
    provider: "dev",
    providerId: "rahul.sharma@student.edu",
    role: "student",
    avatar: "https://ui-avatars.com/api/?name=Rahul+Sharma&background=3b82f6&color=fff",
    college: "IIT Delhi",
    city: "Delhi",
    branch: "Computer Science",
    batchYear: 2024
  },
  {
    name: "Priya Patel",
    email: "priya.patel@student.edu",
    provider: "dev",
    providerId: "priya.patel@student.edu",
    role: "student",
    avatar: "https://ui-avatars.com/api/?name=Priya+Patel&background=10b981&color=fff",
    college: "NIT Surat",
    city: "Surat",
    branch: "Information Technology",
    batchYear: 2024
  }
];

const FEEDBACK = [
  { type: "Company suggestion", name: "Priya Menon", email: "priya.menon@vjti.edu.in", message: "Could you add a room for Zoho?", status: "New" },
  { type: "Company suggestion", name: "Arjun Das", email: "arjun.das@nitk.edu.in", message: "Please add Flipkart — it's one of the biggest recruiters on our campus.", status: "New" },
  { type: "General inquiry", name: "Sneha Kumar", email: "sneha.kumar@mit.edu", message: "How do I share my interview experience?", status: "New" },
  { type: "Bug report", name: "Vikram Singh", email: "vikram.singh@iiit.edu", message: "The chat is not loading properly on mobile.", status: "In progress" },
];

async function seed({ quiet = false } = {}) {
  const log = (...args) => !quiet && console.log(...args);

  const alreadyConnected = mongoose.connection.readyState === 1;
  if (!alreadyConnected) {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      log("No MONGO_URI provided, assuming in-memory database connection is already established");
    } else {
      await mongoose.connect(uri);
      log("Connected to", uri);
    }
  }

  // Clear existing data
  await Promise.all([
    Room.deleteMany({}),
    Feedback.deleteMany({}),
    User.deleteMany({}),
    Message.deleteMany({})
  ]);

  // Insert demo data
  const rooms = await Room.insertMany(ROOMS);
  const feedbacks = await Feedback.insertMany(FEEDBACK);
  const users = await User.insertMany(DEMO_USERS);

  // Create some sample messages and experiences
  const sampleMessages = [];
  
  // Add welcome messages to some rooms
  const welcomeRooms = ['amazon', 'google', 'tcs'];
  for (const roomSlug of welcomeRooms) {
    const room = rooms.find(r => r.slug === roomSlug);
    const demoUser = users.find(u => u.role === 'student');
    
    if (room && demoUser) {
      // Welcome text message
      sampleMessages.push({
        room: room._id,
        sender: demoUser._id,
        type: 'text',
        text: `Welcome to the ${room.name} discussion room! Share your interview experiences and connect with fellow students.`,
        status: 'Approved'
      });
      
      // Sample experience (for Amazon room)
      if (roomSlug === 'amazon') {
        sampleMessages.push({
          room: room._id,
          sender: demoUser._id,
          type: 'experience',
          role: 'SDE Intern',
          city: 'Bengaluru',
          verdict: 'Selected',
          summary: 'Great interview experience! The interviewers were very friendly and focused on problem-solving skills.',
          rounds: [
            { title: 'Online Assessment', note: 'Two coding problems - array manipulation and tree traversal' },
            { title: 'Technical Round 1', note: 'Discussion about projects, system design basics' },
            { title: 'Technical Round 2', note: 'Advanced coding problems, time complexity analysis' },
            { title: 'HR Round', note: 'Discussion about career goals and company culture' }
          ],
          status: 'Approved'
        });
      }
    }
  }

  if (sampleMessages.length > 0) {
    await Message.insertMany(sampleMessages);
  }

  log("Seed complete:");
  log(`  ${rooms.length} rooms`);
  log(`  ${users.length} users (including demo admin)`);
  log(`  ${feedbacks.length} feedback items`);
  log(`  ${sampleMessages.length} sample messages/experiences`);
  log(`  Demo admin: demo-admin@placementdesk.app`);
  log(`  Students can login with any email using dev-login`);

  if (!alreadyConnected && process.env.MONGO_URI) {
    await mongoose.disconnect();
  }
  
  return { rooms, feedbacks, users, messages: sampleMessages };
}

if (require.main === module) {
  seed()
    .then(() => {
      console.log("Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}

module.exports = seed;
