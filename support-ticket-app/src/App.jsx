import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';

function App() {
  const [userInfo, setUserInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState(null);
  const [isResolved, setIsResolved] = useState(false);
  const messagesEndRef = useRef(null);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const handleStartChat = (details) => {
    setUserInfo(details);
    setMessages([{ role: 'assistant', content: `Hello ${details.name}! How can I help you today?` }]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const body = {
        messages: newMessages,
        ticketId: ticketId
      };
      if (!ticketId) {
        body.userInfo = userInfo;
      }
      const res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.aiMessage.ticketId) {
          setTicketId(data.aiMessage.ticketId);
        }
        const aiResponse = data.aiMessage;
        setMessages(prev => [...prev, aiResponse]);
        if (aiResponse.content.toLowerCase().includes('resolved?')) {
          setIsResolved(true);
        }
      } else {
        const errorMessage = { role: 'assistant', content: `Error: ${data.error || 'Something went wrong.'}` };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (err) {
      const errorMessage = { role: 'assistant', content: 'Error: Could not connect to the server.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    await fetch('http://localhost:3000/api/ticket/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId }),
    });
    alert('Your ticket has been escalated. A human will be in touch shortly.');
  };

  const handleUrgent = async () => {
    await fetch('http://localhost:3000/api/ticket/urgent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId }),
    });
    alert('Your ticket has been marked as urgent.');
  };
  
  const handleReset = () => {
    setUserInfo(null);
    setMessages([]);
    setTicketId(null);
    setIsResolved(false);
    setShowReviewForm(false);
  };

  const handleShowReview = () => {
    setShowReviewForm(true);
  };

  return (
    <div className="support-chat-outer">
      {!userInfo ? (
        <PreChatForm onStartChat={handleStartChat} />
      ) : (
        <div className="chat-container">
          <div className="chat-header">
            <h2>Support Chat</h2>
          </div>
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            ))}
            {loading && (
              <div className="message assistant">
                <span className="typing-indicator">...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {isResolved ? (
            <div className="resolution-buttons">
              <button onClick={handleShowReview}>Exit - Sorted the problem out</button>
              <button onClick={handleReset}>Log Another Ticket</button>
            </div>
          ) : (
            <form className="chat-input-form" onSubmit={handleSubmit} autoComplete="off">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={loading}
                autoFocus
              />
              <button type="submit" disabled={loading}>Send</button>
            </form>
          )}

          {ticketId && !isResolved && (
            <div className="action-buttons">
              <button onClick={handleEscalate}>Escalate to Human</button>
              <button onClick={handleUrgent}>Mark as Urgent</button>
            </div>
          )}
        </div>
      )}
      {showReviewForm && ticketId && (
        <ReviewForm ticketId={ticketId} onSubmitted={handleReset} />
      )}
    </div>
  );
}

function PreChatForm({ onStartChat }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && email) {
      onStartChat({ name, email, phone });
    }
  };

  return (
    <div className="pre-chat-form-container">
      <h2>Get Started</h2>
      <p>Please provide your details to begin.</p>
      <form onSubmit={handleSubmit}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" required />
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number (Optional)" />
        <button type="submit">Start Chat</button>
      </form>
    </div>
  );
}

function ReviewForm({ ticketId, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    await fetch('http://localhost:3000/api/ticket/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, rating, comment }),
    });
    alert('Thank you for your feedback!');
    onSubmitted();
  };

  return (
    <form className="review-form" onSubmit={handleReviewSubmit}>
      <h4>Leave a Review</h4>
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} onClick={() => setRating(star)}>{rating >= star ? '★' : '☆'}</span>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us about your experience..." />
      <button type="submit">Submit Review</button>
    </form>
  );
}

export default App;
