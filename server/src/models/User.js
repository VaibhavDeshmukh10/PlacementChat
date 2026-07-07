const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    avatar: { type: String },
    provider: { type: String, enum: ["google", "github", "dev"], required: true },
    providerId: { type: String, required: true },
    college: { type: String, default: "" },
    city: { type: String, default: "" },
    branch: { type: String, default: "" },
    batchYear: { type: Number },
    role: { type: String, enum: ["student", "admin"], default: "student" },
    status: { type: String, enum: ["active", "banned"], default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
