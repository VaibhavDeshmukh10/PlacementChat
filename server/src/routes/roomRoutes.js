const express = require("express");
const Room = require("../models/Room");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const { uploadCompanyLogo } = require("../config/cloudinary");
const router = express.Router();

// GET /api/rooms — public, used by the landing page
// Hide non-published logos from public responses
function slugifyCity(city) {
  return String(city || "").toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

router.get("/", async (req, res) => {
  try {
    const io = req.app.get("io");
    const getLiveCount = io?.getRoomMemberCount;
    const rooms = await Room.find({ status: "Active" }).sort({ name: 1 });
    const mapped = rooms.map((r) => {
      const obj = r.toObject();
      let liveCount = 0;

      if (typeof getLiveCount === "function") {
        liveCount += getLiveCount(r.slug);
        if (Array.isArray(r.cities)) {
          for (const city of r.cities) {
            const cityRoomSlug = `${r.slug}-${slugifyCity(city)}`;
            liveCount += getLiveCount(cityRoomSlug);
          }
        }
      }

      obj.memberCount = liveCount || obj.memberCount;
      if (!obj.logoVisible) delete obj.logoUrl;
      delete obj.logoVisible; // keep API surface smaller for public
      return obj;
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/rooms/all — admin only, includes hidden rooms
router.get("/all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rooms = await Room.find().sort({ name: 1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/rooms/:slug — a single room's details
router.get("/:slug", async (req, res) => {
  try {
    const room = await Room.findOne({ slug: req.params.slug.toLowerCase() });
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/rooms — admin only, matches the "Add room" modal
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, domain, cities, status } = req.body;
    if (!name || !cities) {
      return res.status(400).json({ message: "name and cities are required" });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const room = await Room.create({
      name,
      slug,
      domain: domain || "",
      cities: Array.isArray(cities) ? cities : cities.split(",").map((c) => c.trim()),
      status: status || "Active",
    });
    res.status(201).json(room);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A room with that name already exists" });
    }
    res.status(500).json({ message: err.message });
  }
});

// POST /api/rooms/:id/logo — admin only. Attach uploaded logo to room but keep it private until published.
router.post('/:id/logo', requireAuth, requireAdmin, (req, res) => {
  uploadCompanyLogo.single('logo')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    try {
      const url = req.file.path;
      const room = await Room.findByIdAndUpdate(req.params.id, { logoUrl: url, logoVisible: false }, { new: true });
      if (!room) return res.status(404).json({ message: 'Room not found' });
      res.json({ message: 'Logo uploaded (private)', file: { url, publicId: req.file.filename }, room });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });
});

// PATCH /api/rooms/:id/logo/publish — admin only. Toggle public visibility of the room logo.
router.patch('/:id/logo/publish', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { visible } = req.body;
    if (typeof visible !== 'boolean') return res.status(400).json({ message: 'visible must be boolean' });
    const room = await Room.findByIdAndUpdate(req.params.id, { logoVisible: visible }, { new: true });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/rooms/:id — admin only, e.g. toggling Active/Hidden
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const allowed = {};
    const { name, domain, logoUrl, cities, status, memberCount } = req.body;
    if (name !== undefined) allowed.name = name;
    if (domain !== undefined) allowed.domain = domain;
    if (logoUrl !== undefined) allowed.logoUrl = logoUrl;
    if (cities !== undefined) allowed.cities = Array.isArray(cities) ? cities : cities.split(",").map((c) => c.trim());
    if (status !== undefined) allowed.status = status;
    if (memberCount !== undefined) allowed.memberCount = memberCount;
    const room = await Room.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/rooms/:id — admin only
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json({ message: "Room deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
