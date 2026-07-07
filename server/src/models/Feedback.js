const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Company suggestion", "General inquiry", "Bug report"],
      required: true,
    },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    message: { type: String, required: true },
    status: { type: String, enum: ["New", "In progress", "Resolved"], default: "New" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
