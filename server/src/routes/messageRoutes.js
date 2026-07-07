const express = require("express");
const Message = require("../models/Message");
const Room = require("../models/Room");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/rooms/:slug/messages — full feed for a room (text + experiences)
// Supports city filter via ?city=cityname query parameter
router.get("/:slug/messages", async (req, res) => {
  try {
    const { city } = req.query; // Optional city filter
    
    const room = await Room.findOne({ slug: req.params.slug.toLowerCase() });
    if (!room) return res.status(404).json({ message: "Room not found" });

    // Build filter - include city if specified
    const filter = { 
      room: room._id, 
      status: { $in: ["Approved"] } 
    };
    
    // If city is specified, only show messages for that city
    if (city) {
      filter.city = city;
    }

    const messages = await Message.find(filter)
      .populate("sender", "name avatar _id")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/rooms/:slug/messages — plain text chat message
router.post("/:slug/messages", requireAuth, async (req, res) => {
  try {
    const room = await Room.findOne({ slug: req.params.slug.toLowerCase() });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const { text, city } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "text is required" });
    if (!city?.trim()) return res.status(400).json({ message: "city is required" });

    const message = await Message.create({
      room: room._id,
      sender: req.user.id,
      type: "text",
      text: text.trim(),
      city: city.trim(),  // Store city with message
      status: "Approved",
    });

    const populated = await message.populate("sender", "name avatar _id");
    
    // Emit the message via Socket.io to city-specific room
    const io = req.app.get("io");
    if (io) {
      // Slugify city for room name
      const slugifyCity = (c) => c.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const roomIdentifier = `${room.slug}-${slugifyCity(city)}`;
      io.to(roomIdentifier).emit("message-received", populated);
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creating message:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/rooms/:slug/experiences — structured interview experience post
// Goes in as "Pending" so it shows up in the admin moderation queue first.
router.post("/:slug/experiences", requireAuth, async (req, res) => {
  try {
    const room = await Room.findOne({ slug: req.params.slug.toLowerCase() });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const { role, city, verdict, summary, rounds } = req.body;
    if (!role || !city || !summary) {
      return res.status(400).json({ message: "role, city, and summary are required" });
    }

    const message = await Message.create({
      room: room._id,
      sender: req.user.id,
      type: "experience",
      role,
      city,
      verdict: verdict || "In progress",
      summary,
      rounds: rounds || [],
      status: "Pending", // an admin approves it in the Interview Experiences queue
    });

    const populated = await message.populate("sender", "name avatar _id");
    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creating experience:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/rooms/pending — admin moderation queue (moved to correct path structure)
router.get("/pending", requireAuth, requireAdmin, async (req, res) => {
  try {
    const messages = await Message.find({ type: "experience", status: "Pending" })
      .populate("sender", "name email _id")
      .populate("room", "name")
      .sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error("Error fetching pending messages:", err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/rooms/moderate/:id — admin approve/reject
router.patch("/moderate/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body; // "Approved" | "Rejected"
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be Approved or Rejected" });
    }
    
    const message = await Message.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate("sender", "name avatar _id")
      .populate("room", "name slug");
      
    if (!message) return res.status(404).json({ message: "Message not found" });

    // If approved, broadcast to room
    if (status === "Approved" && message.room?.slug) {
      const io = req.app.get("io");
      if (io) {
        io.to(message.room.slug).emit("new-message", message);
      }
    }

    res.json(message);
  } catch (err) {
    console.error("Error moderating message:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
