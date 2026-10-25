import Notification from '../models/Notification.js';
import AppError from '../utils/AppError.js';

export async function list(req, res, next) {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { read: true } },
      { returnDocument: 'after' },
    );
    if (!notification) {
      throw new AppError('NOT_FOUND', 'Notification not found');
    }
    res.json({ notification });
  } catch (error) {
    next(error);
  }
}

export async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } },
    );
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    next(error);
  }
}
