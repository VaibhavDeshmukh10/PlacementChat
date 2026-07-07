const express = require("express");
const Feedback = require("../models/Feedback");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// POST /api/feedback — public, used by the "Suggest a company" modal
router.post("/", async (req, res) => {
  try {
    const { type, name, email, message } = req.body;
    if (!name?.trim() || !message?.trim()) {
      return res.status(400).json({ message: "name and message are required" });
    }
    const feedback = await Feedback.create({
      type: type || "Company suggestion",
      name: name.trim(),
      email: email?.trim() || "",
      message: message.trim(),
    });
    res.status(201).json(feedback);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/feedback — admin only, the Feedback & Suggestions inbox
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status && status !== "All" ? { status } : {};
    const items = await Feedback.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/feedback/:id — admin only, e.g. "Mark room added" / "Mark resolved"
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["New", "In progress", "Resolved"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(", ")}` });
    }
    const item = await Feedback.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!item) return res.status(404).json({ message: "Feedback not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
