const express = require("express");
const User = require("../models/User");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/users — admin only, the Users table in the admin panel
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-__v").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/users/:id — admin only, ban/reinstate or promote
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const allowed = {};
    if (req.body.status && ["active", "banned"].includes(req.body.status)) {
      allowed.status = req.body.status;
    }
    if (req.body.role && ["student", "admin"].includes(req.body.role)) {
      allowed.role = req.body.role;
    }
    // Prevent an admin from banning themselves out of the panel
    if (req.params.id === req.user.id && allowed.status === "banned") {
      return res.status(400).json({ message: "You can't ban your own account" });
    }
    const user = await User.findByIdAndUpdate(req.params.id, allowed, { new: true }).select("-__v");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
