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
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Notifications</h1>
        {notifications.some((notification) => !notification.read) && (
          <button
            className="btn-secondary"
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
        <ul className="space-y-3">
          {notifications.map((notification) => (
            <li key={notification._id}>
              <button
                className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-500 sm:p-5 ${
                  notification.read
                    ? 'border-slate-200 bg-white'
                    : 'border-indigo-200 bg-indigo-50/80'
                }`}
                onClick={() => openNotification(notification)}
                type="button"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                    {notification.type?.includes('deliverable')
                      ? <path d="m5 12 4 4L19 6M4 4h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      : notification.type?.includes('message')
                        ? <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                        : <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />}
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-2">
                    {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}
                    <span className="block text-sm font-medium text-slate-800">{notification.text}</span>
                  </span>
                  <time className="mt-2 block text-xs text-slate-500" dateTime={notification.createdAt}>
                    {new Date(notification.createdAt).toLocaleString('en-IN')}
                  </time>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
