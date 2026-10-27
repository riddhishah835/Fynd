import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proposal',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
  },
  { timestamps: true },
);

messageSchema.index({ proposal: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
