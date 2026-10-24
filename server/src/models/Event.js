import mongoose from 'mongoose';

const tierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  slots: { type: Number, required: true, min: 1 },
  slotsFilled: { type: Number, default: 0, min: 0 },
  benefits: [{ type: String, required: true, trim: true }],
});

const eventSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['tech', 'cultural', 'sports', 'business', 'music', 'social', 'other'],
    },
    city: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    expectedFootfall: { type: Number, required: true, min: 0 },
    audienceProfile: { type: String, required: true, trim: true },
    bannerUrl: { type: String },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed'],
      default: 'draft',
      index: true,
    },
    tiers: { type: [tierSchema], default: [] },
    embedding: { type: [Number], select: false },
  },
  { timestamps: true },
);

eventSchema.index({ city: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ startDate: 1 });

eventSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.embedding;
    delete ret.__v;
    return ret;
  },
});

const Event = mongoose.model('Event', eventSchema);

export default Event;
