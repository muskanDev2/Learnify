const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const allowedRoles = ['admin', 'instructor', 'student'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: allowedRoles,
      default: 'student',
      lowercase: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    gender: String,
    phone: String,
    address: String,
    country: String,
    profileImage: String,
    countryLocked: {
      type: Boolean,
      default: false,
    },
    genderLocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    active: this.active,
    gender: this.gender,
    phone: this.phone,
    address: this.address,
    country: this.country,
    profileImage: this.profileImage,
    countryLocked: this.countryLocked,
    genderLocked: this.genderLocked,
  };
};

module.exports = mongoose.model('User', userSchema);
