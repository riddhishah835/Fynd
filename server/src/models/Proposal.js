import mongoose from 'mongoose';

const tierSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    benefits: [{ type: String }],
  },
  { _id: false },
);

const historyEntrySchema = new mongoose.Schema(
  {
    from: {
      type: String,
      enum: ['pending', 'countered', 'accepted', 'rejected', 'withdrawn', 'completed', null],
      default: null,
    },
    to: {
      type: String,
      required: true,
      enum: ['pending', 'countered', 'accepted', 'rejected', 'withdrawn', 'completed'],
    },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const proposalSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    tierId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sponsor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tierSnapshot: { type: tierSnapshotSchema, required: true },
    amount: { type: Number, required: true, min: 0 },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'countered', 'accepted', 'rejected', 'withdrawn', 'completed'],
      default: 'pending',
      required: true,
      index: true,
    },
    counterNote: { type: String, default: '' },
    history: { type: [historyEntrySchema], default: [] },
  },
  { timestamps: true },
);

proposalSchema.index(
  { sponsor: 1, event: 1, tierId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'countered'] } },
  },
);
proposalSchema.index({ sponsor: 1 });
proposalSchema.index({ organizer: 1 });
proposalSchema.index({ event: 1 });

const Proposal = mongoose.model('Proposal', proposalSchema);

export default Proposal;
