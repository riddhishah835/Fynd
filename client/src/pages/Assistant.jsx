import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axios.js';
import Loader from '../components/Loader.jsx';
import ErrorBox from '../components/ErrorBox.jsx';

const sponsorSuggestions = [
  'Find tech events in Bengaluru under 30000',
  'What needs my attention?',
  'Which tier fits my budget for <ask me>',
];

const organizerSuggestions = [
  'What proposals need my response?',
  'Summarize my latest proposal chat',
  'How are my deliverables going?',
];

function renderMarkdown(text) {
  if (!text) return <span />;
  
  const lines = text.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBlockContent = [];
  let inList = false;
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="ml-4 my-2 space-y-1 list-disc">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm">{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInlineMarkdown = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return <code key={i} className="bg-slate-200 px-1 rounded text-indigo-700 font-mono text-xs">{part.slice(1, -1)}</code>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${elements.length}`} className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto my-2">
            <code className="font-mono text-sm">{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
      if (!inList) {
        inList = true;
      }
      listItems.push(trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
      continue;
    }

    if (inList) {
      flushList();
      inList = false;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={elements.length} className="text-base font-semibold text-slate-900 mt-3 mb-1">{trimmed.slice(4)}</h3>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={elements.length} className="text-lg font-semibold text-slate-900 mt-3 mb-1">{trimmed.slice(3)}</h2>);
    } else if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={elements.length} className="text-xl font-semibold text-slate-900 mt-3 mb-1">{trimmed.slice(2)}</h1>);
    } else if (trimmed === '') {
      elements.push(<br key={elements.length} />);
    } else {
      elements.push(<p key={elements.length} className="whitespace-pre-wrap text-sm">{renderInlineMarkdown(line)}</p>);
    }
  }

  flushList();
  return <div className="prose prose-sm max-w-none">{elements}</div>;
}

export default function Assistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const suggestions = user?.role === 'sponsor' ? sponsorSuggestions : organizerSuggestions;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/assistant', { messages: newMessages.slice(-20) });
      const assistantMessage = { role: 'assistant', content: data.reply };
      setMessages(prev => [...prev, assistantMessage]);
      if (data.toolsUsed?.length) {
        setMessages(prev => [...prev.slice(0, -1), { ...assistantMessage, toolsUsed: data.toolsUsed }]);
      }
    } catch (err) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (text) => {
    setInput(text);
  };

  const handleClear = () => {
    setMessages([]);
    setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-500">
            <svg
              aria-hidden="true"
              className="h-12 w-12 mb-4 text-indigo-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Ask Fynd Assistant</h2>
            <p className="text-sm max-w-xs mb-6">
              I can look up events, proposals, chats, and suggest tiers. I can't take actions — only you can.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(s)}
                  className="btn-ghost text-sm px-3 py-1.5 whitespace-nowrap"
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-slate-100 text-slate-900 rounded-bl-md'
              }`}
            >
              <div className="text-sm">{renderMarkdown(msg.content)}</div>
              {msg.role === 'assistant' && msg.toolsUsed?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.toolsUsed.map((tool, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-600"
                    >
                      <svg
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {tool.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 text-slate-900 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[75%] flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="h-5 w-5 animate-spin text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
              </svg>
              <span className="text-sm">Thinking…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <ErrorBox message={error} />
            <button
              onClick={() => setError('')}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label="Dismiss"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className="border-t border-slate-200 p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me about events, proposals, or tiers…"
            rows={1}
            maxLength={1000}
            className="flex-1 min-h-[44px] max-h-32 px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="btn-primary h-10 px-4 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
          <span>{input.length}/1000</span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-500 hover:text-slate-700 underline"
            >
              Clear conversation
            </button>
          )}
        </div>
      </form>
    </div>
  );
}