const mongoose = require("mongoose");

const roundSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["text", "experience"], default: "text" },

    // used when type === "text"
    text: { type: String },

    // used when type === "experience"
    role: { type: String },
    city: { type: String },
    verdict: { type: String, enum: ["Selected", "Rejected", "In progress"] },
    summary: { type: String },
    rounds: [roundSchema],

    // moderation, mirrors the admin panel's Interview Experiences queue
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Approved" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
