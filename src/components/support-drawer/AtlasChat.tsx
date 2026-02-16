import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type AtlasChatProps = {
  onClose?: (e: React.MouseEvent) => void;
};

const AtlasChat = ({ onClose }: AtlasChatProps) => {
  const [isOpen, setIsOpen] = useState(true); // 🔴 control visibility
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome to Atlas Homestays. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

const API_URL = import.meta.env.VITE_CHAT_API_URL;
const AUTH_KEY = import.meta.env.VITE_ATLAS_AUTH_KEY;

  const handleSend = async (overrideInput?: string) => {
    const text = overrideInput || input;
    if (!text.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Atlas-Auth-Key': AUTH_KEY
        },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Server not responding. Please try again.' }
      ]);
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
    <div className="fixed bottom-4 right-4 w-[300px] h-[320px] bg-white border border-slate-200 rounded-lg shadow-lg flex flex-col z-[999] overflow-hidden">

      {/* Header */}
      <div className="p-1.5 bg-[#2c5282] text-white flex justify-between items-center border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-xs">Atlas Concierge</h2>
          <span className="text-xs opacity-80">•</span>
          <p className="text-xs opacity-90">24/7</p>
        </div>

        {/* ❌ CROSS BUTTON */}
        <button
          onClick={onClose || (() => setIsOpen(false))}
          className="p-0.5 rounded-full hover:bg-white/20 transition text-white/80 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 bg-white text-xs">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[92%] px-2 py-0.5 rounded text-xs leading-tight shadow-xs
                ${
                  m.role === 'user'
                    ? 'bg-[#2c5282] text-white'
                    : 'bg-slate-50 text-slate-800 border border-slate-100'
                }`}
            >
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-1.5 bg-white border-t border-slate-100 flex items-center gap-1">
        <button
          onClick={startSpeechToText}
          className={`p-1 rounded-full text-[11px] ${
            isListening ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Mic size={18} />
        </button>

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          className="flex-1 bg-white border border-slate-200 rounded text-[11px] px-2 py-1 text-slate-800 outline-none focus:border-blue-300"
        />

        <button
          onClick={() => handleSend()}
          className="p-1 rounded-full bg-[#2c5282] text-white text-[11px]"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default AtlasChat;
