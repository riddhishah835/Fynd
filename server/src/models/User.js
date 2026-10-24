import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ['organizer', 'sponsor'] },
    organization: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    bio: { type: String, trim: true },
    website: { type: String, trim: true },
    industry: { type: String, trim: true },
    targetAudience: { type: String, trim: true },
    budgetMin: { type: Number, min: 0 },
    budgetMax: { type: Number, min: 0 },
    goals: { type: String, trim: true },
    embedding: { type: [Number], select: false },
    orgType: { type: String, enum: ['college', 'club', 'community', 'other'] },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.passwordHash;
    delete ret.embedding;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

export default User;
