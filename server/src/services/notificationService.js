import Notification from '../models/Notification.js';

export async function notify(userId, type, text, link) {
  try {
    return await Notification.create({ user: userId, type, text, link });
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }
}
