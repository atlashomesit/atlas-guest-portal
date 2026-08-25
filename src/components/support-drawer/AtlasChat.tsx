import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';
import { getTenantBrandName } from '@/tenant/displayBrand';

type AtlasChatProps = {
  onClose?: (e: React.MouseEvent) => void;
  /** When set (e.g. on listing detail), FAQ-backed chat can match property questions. */
  listingId?: string | null;
};

const AtlasChat = ({ onClose, listingId = null }: AtlasChatProps) => {
  const brandName = getTenantBrandName();
  const [isOpen, setIsOpen] = useState(true); // 🔴 control visibility
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Welcome to ${brandName}. How can I help you today?` }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async (overrideInput?: string) => {
    const text = overrideInput || input;
    if (!text.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');

    try {
      const listingNum =
        listingId != null && listingId !== '' && !Number.isNaN(Number(listingId))
          ? Number(listingId)
          : null;
      const res = await fetch(buildApiUrl('/api/public/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiHeaders(),
        },
        body: JSON.stringify({ listingId: listingNum, message: text }),
      });

      if (!res.ok) {
        throw new Error(await messageFromApiResponse(res));
      }

      const data = (await res.json()) as { reply?: string };
      const reply =
        typeof data.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : 'No reply from the assistant. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'We could not reach the chat service. Please check your connection and try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
    }
  };

  const startSpeechToText = () => {
    const SpeechRecognition =
      (window as Window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
      (window as Window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognition) return alert('Voice not supported');

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      handleSend(e.results[0][0].transcript);
    };

    recognition.start();
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 🔴 CLOSE CHAT COMPLETELY
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[300px] h-[320px] bg-bg-surface border border-border-subtle rounded-lg shadow-lg flex flex-col z-[999] overflow-hidden">

      {/* Header */}
      {/* TASK-4969: use the theme tokens every sibling support-drawer component uses
          (--cta-primary / --text-on-cta / --bg-surface) instead of hardcoded navy. */}
      <div className="p-1.5 bg-cta-primary text-[var(--text-on-cta)] flex justify-between items-center border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-xs">{`${brandName} Concierge`}</h2>
          <span className="text-xs opacity-80">•</span>
          <p className="text-xs opacity-90">24/7</p>
        </div>

        {/* ❌ CROSS BUTTON */}
        <button
          onClick={onClose || (() => setIsOpen(false))}
          aria-label="Close"
          className="p-0.5 rounded-full hover:bg-[color-mix(in_srgb,var(--text-on-cta)_20%,transparent)] transition text-[color-mix(in_srgb,var(--text-on-cta)_80%,transparent)] hover:text-[var(--text-on-cta)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 bg-bg-surface text-xs">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[92%] px-2 py-0.5 rounded text-xs leading-tight shadow-xs
                ${
                  m.role === 'user'
                    ? 'bg-cta-primary text-[var(--text-on-cta)]'
                    : 'bg-bg-muted text-text-primary border border-border-subtle'
                }`}
            >
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-1.5 bg-bg-surface border-t border-border-subtle flex items-center gap-1">
        <button
          onClick={startSpeechToText}
          aria-label="Start voice input"
          className={`p-1 rounded-full text-[11px] ${
            isListening ? 'bg-[var(--support-error)] text-[var(--text-on-cta)]' : 'bg-bg-muted text-text-muted hover:bg-[color-mix(in_srgb,var(--bg-muted)_60%,var(--text-muted)_10%)]'
          }`}
        >
          <Mic size={18} aria-hidden="true" />
        </button>

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          className="flex-1 bg-bg-surface border border-border-subtle rounded text-[11px] px-2 py-1 text-text-primary outline-none focus:border-accent-primary"
        />

        <button
          onClick={() => handleSend()}
          aria-label="Send message"
          className="p-1 rounded-full bg-cta-primary text-[var(--text-on-cta)] text-[11px]"
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default AtlasChat;
