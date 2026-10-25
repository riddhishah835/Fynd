import mongoose from 'mongoose';

const deliverableSchema = new mongoose.Schema(
  {
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proposal',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'approved', 'disputed'],
      default: 'pending',
      required: true,
    },
    proofUrl: { type: String },
    note: { type: String },
  },
  { timestamps: true },
);

const Deliverable = mongoose.model('Deliverable', deliverableSchema);

export default Deliverable;
