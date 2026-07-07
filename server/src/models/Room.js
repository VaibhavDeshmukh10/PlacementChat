const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    domain: { type: String, default: "" }, // used to look up the company logo
    logoUrl: { type: String, default: "" },
    logoVisible: { type: Boolean, default: false },
    cities: [{ type: String }],
    status: { type: String, enum: ["Active", "Hidden"], default: "Active" },
    memberCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
