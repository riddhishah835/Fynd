import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axios.js';
import { createSocket } from '../api/socket.js';
import ErrorBox from './ErrorBox.jsx';
import Loader from './Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function messageId(message) {
  return typeof message._id === 'string' ? message._id : message._id.toString();
}

function dateLabel(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function timeLabel(value) {
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function ChatPanel({ proposalId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesRef = useRef([]);
  const loadGenerationRef = useRef(0);
  const scrollRef = useRef(null);
  const shouldScrollRef = useRef(true);

  const mergeMessages = useCallback((incoming) => {
    if (!incoming.length) return;
    const container = scrollRef.current;
    shouldScrollRef.current = !container
      || container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    const knownIds = new Set(messagesRef.current.map(messageId));
    const merged = [...messagesRef.current];
    for (const message of incoming) {
      if (!knownIds.has(messageId(message))) {
        knownIds.add(messageId(message));
        merged.push(message);
      }
    }
    merged.sort((left, right) => (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    ));
    messagesRef.current = merged;
    setMessages(merged);
  }, []);

  const loadHistory = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setLoadError('');
    setHistoryLoaded(false);
    messagesRef.current = [];
    setMessages([]);
    try {
      const { data } = await api.get(`/proposals/${proposalId}/messages`);
      if (generation !== loadGenerationRef.current) return;
      messagesRef.current = data.messages;
      setMessages(data.messages);
      shouldScrollRef.current = true;
      setHistoryLoaded(true);
    } catch (error) {
      if (generation === loadGenerationRef.current) setLoadError(error.message);
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    loadHistory();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadHistory]);

  useEffect(() => {
    if (!historyLoaded) return undefined;

    const socket = createSocket();
    setConnected(false);
    const onConnect = () => {
      setConnected(true);
      socket.emit('proposal:join', proposalId, () => {});
    };
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => setConnected(false);
    const onMessage = (message) => mergeMessages([message]);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onMessage);
    socket.connect();

    return () => {
      if (socket.connected) socket.emit('proposal:leave', proposalId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('message:new', onMessage);
      socket.disconnect();
    };
  }, [historyLoaded, mergeMessages, proposalId]);

  useEffect(() => {
    if (!historyLoaded || connected) return undefined;

    const poll = async () => {
      const latest = messagesRef.current.at(-1);
      const params = new URLSearchParams({ limit: '200' });
      if (latest) {
        const after = new Date(new Date(latest.createdAt).getTime() - 1).toISOString();
        params.set('after', after);
      }
      try {
        const { data } = await api.get(
          `/proposals/${proposalId}/messages?${params.toString()}`,
        );
        mergeMessages(data.messages);
      } catch {
        // Keep the last good chat history while reconnecting.
      }
    };

    const interval = window.setInterval(poll, 8000);
    return () => window.clearInterval(interval);
  }, [connected, historyLoaded, mergeMessages, proposalId]);

  useEffect(() => {
    if (shouldScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setSendError('');
    try {
      const { data } = await api.post(`/proposals/${proposalId}/messages`, { text });
      mergeMessages([data.message]);
      setText('');
    } catch (error) {
      setSendError(error.message);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (loading) return <Loader />;
  if (loadError) {
    return (
      <div className="space-y-2">
        <ErrorBox message={loadError} />
        <button className="btn-secondary" onClick={loadHistory} type="button">
          Retry
        </button>
      </div>
    );
  }

  let previousDate = '';
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Chat</h2>
        <p className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'animate-pulse bg-amber-400'}`} />
          {connected ? 'Live' : 'Reconnecting... (messages still update)'}
        </p>
      </div>
      <div
        className="h-96 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4"
        ref={scrollRef}
      >
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No messages yet. Say hello.</p>
        ) : messages.map((message) => {
          const date = dateLabel(message.createdAt);
          const isOwn = message.sender._id === user._id;
          const showDate = date !== previousDate;
          previousDate = date;
          return (
            <div key={messageId(message)}>
              {showDate && (
                <p className="my-3 text-center text-xs text-slate-400">{date}</p>
              )}
              <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                  isOwn
                    ? 'rounded-br-sm bg-gradient-to-br from-indigo-600 to-violet-600 text-white'
                    : 'rounded-bl-sm border border-slate-200 bg-white text-slate-900'
                }`}>
                  {!isOwn && <p className="mb-1 text-xs font-semibold text-slate-700">{message.sender.name}</p>}
                  <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                  <time className="mt-1 block text-right text-[11px] opacity-75" dateTime={message.createdAt}>
                    {timeLabel(message.createdAt)}
                  </time>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {sendError && <ErrorBox message={sendError} />}
      <form
        className="sticky bottom-0 space-y-2 border-t border-slate-100 bg-white pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <textarea
          className="input resize-none text-sm"
          maxLength={1000}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write a message..."
          rows={3}
          value={text}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">{text.length}/1000</span>
          <button
            aria-label={sending ? 'Sending message' : 'Send message'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!text.trim() || sending}
            type="submit"
          >
            {sending ? null : (
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                <path d="m5 12 14-7-5 14-2-6-7-1Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
            )}
            <span className="sr-only">{sending ? 'Sending...' : 'Send'}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
