import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Empty from '../components/Empty.jsx';
import ErrorBox from '../components/ErrorBox.jsx';
import Loader from '../components/Loader.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

export default function Notifications() {
  const {
    notifications,
    loading,
    error,
    markRead,
    markAllRead,
  } = useNotifications();
  const [actionError, setActionError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();

  const openNotification = async (notification) => {
    setActionError('');
    try {
      if (!notification.read) await markRead(notification._id);
      navigate(notification.link);
    } catch (requestError) {
      setActionError(requestError.message);
    }
  };

  const handleMarkAllRead = async () => {
    setActionError('');
    setMarkingAll(true);
    try {
      await markAllRead();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {notifications.some((notification) => !notification.read) && (
          <button
            className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
            disabled={markingAll}
            onClick={handleMarkAllRead}
            type="button"
          >
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>
      {actionError && <ErrorBox message={actionError} />}
      {loading && notifications.length === 0 && <Loader />}
      {!loading && error && notifications.length === 0 && <ErrorBox message={error} />}
      {!loading && !error && notifications.length === 0 && <Empty message="No notifications" />}
      {notifications.length > 0 && (
        <ul className="space-y-2">
          {notifications.map((notification) => (
            <li key={notification._id}>
              <button
                className={`w-full rounded border p-4 text-left ${
                  notification.read
                    ? 'border-gray-200 bg-white'
                    : 'border-blue-300 bg-blue-50'
                }`}
                onClick={() => openNotification(notification)}
                type="button"
              >
                <span className="block">{notification.text}</span>
                <time
                  className="mt-1 block text-xs text-gray-500"
                  dateTime={notification.createdAt}
                >
                  {new Date(notification.createdAt).toLocaleString('en-IN')}
                </time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
