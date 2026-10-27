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
        <button className="text-sm text-blue-700 underline" onClick={loadHistory} type="button">
          Retry
        </button>
      </div>
    );
  }

  let previousDate = '';
  return (
    <section className="space-y-3 rounded border border-gray-300 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Chat</h2>
        <p className="text-xs text-gray-600">
          {connected ? 'Live' : 'Reconnecting... (messages still update)'}
        </p>
      </div>
      <div
        className="h-96 space-y-3 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3"
        ref={scrollRef}
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No messages yet. Say hello.</p>
        ) : messages.map((message) => {
          const date = dateLabel(message.createdAt);
          const isOwn = message.sender._id === user._id;
          const showDate = date !== previousDate;
          previousDate = date;
          return (
            <div key={messageId(message)}>
              {showDate && (
                <p className="my-3 text-center text-xs text-gray-500">{date}</p>
              )}
              <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  isOwn ? 'bg-blue-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                }`}>
                  {!isOwn && <p className="mb-1 text-xs font-semibold">{message.sender.name}</p>}
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
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <textarea
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          maxLength={1000}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write a message..."
          rows={3}
          value={text}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">{text.length}/1000</span>
          <button
            className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={!text.trim() || sending}
            type="submit"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}
