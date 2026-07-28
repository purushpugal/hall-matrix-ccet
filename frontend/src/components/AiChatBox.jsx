import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export const AiChatBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Hello! I am your **Matrix AI Assistant**. How can I help you today with exam hall seating, invigilator rosters, or schedule lookup?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const quickPrompts = [
    '🎓 Where is my hall?',
    '📅 Inaiku enna exam?',
    '📊 Show total students and halls'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const data = await api.post('/ai/chat', { message: text });

      if (data && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: data.reply,
            type: data.type,
            student: data.student,
            schedule: data.schedule,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        throw new Error(data.error || 'No response from AI');
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: '⚠️ I apologize, I encountered an issue connecting to the system server. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderFormattedText = (text) => {
    // Basic Markdown formatting helper
    return text.split('\n').map((line, lIdx) => {
      let formattedLine = line;

      // Bold text **text**
      const parts = formattedLine.split(/(\*\*.*?\*\*|`.*?`)/g);

      return (
        <p key={lIdx} style={{ margin: '0 0 6px 0', lineHeight: '1.55' }}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} style={{ color: '#ffffff' }}>{part.slice(2, -2)}</strong>;
            } else if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code
                  key={pIdx}
                  style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#818cf8',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.85em',
                    fontFamily: 'monospace'
                  }}
                >
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="ai-chatbox-wrapper">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          className="ai-chat-trigger"
          onClick={() => setIsOpen(true)}
          title="Open Matrix AI Assistant"
        >
          <div className="ai-trigger-pulse" />
          <svg className="ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
          <span className="ai-trigger-label">Matrix AI</span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="ai-chat-window">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-header-info">
              <div className="ai-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2zM4.93 10.93a10 10 0 0114.14 0M7.76 13.76a6 6 0 018.48 0M12 18v3m-3 0h6" />
                </svg>
              </div>
              <div>
                <h4 className="ai-title">Matrix AI Assistant</h4>
                <div className="ai-status">
                  <span className="online-dot" /> Online • Hall Matrix Intelligence
                </div>
              </div>
            </div>
            <button className="ai-close-btn" onClick={() => setIsOpen(false)} title="Close Chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages Body */}
          <div className="ai-chat-body">
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-message-row ${msg.sender}`}>
                <div className="ai-message-bubble">
                  {renderFormattedText(msg.text)}

                  {/* Interactive Student Profile Card Button */}
                  {msg.type === 'student_profile' && msg.student && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate('/student/dashboard', { state: { student: msg.student } });
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 14px',
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '600',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        👁️ Open Full Student Profile
                      </button>
                    </div>
                  )}

                  {/* Interactive Exam Schedule Card Button */}
                  {msg.type === 'exam_schedule' && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate('/allocation');
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 14px',
                          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '600',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        🧮 Go to Allocation Manager
                      </button>
                    </div>
                  )}

                  <span className="ai-msg-time">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="ai-message-row ai">
                <div className="ai-message-bubble ai-typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="ai-chips-container">
            {quickPrompts.map((chip, idx) => (
              <button
                key={idx}
                className="ai-chip"
                onClick={() => handleSendMessage(chip.replace(/^[^\w]+/, '').trim())}
                disabled={loading}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            className="ai-chat-footer"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              type="text"
              className="ai-input"
              placeholder="Ask Matrix AI anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="ai-send-btn"
              disabled={!input.trim() || loading}
              title="Send Message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3 21l18-9L3 3l3 9zm0 0h75" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
