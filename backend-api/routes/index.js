var express = require('express');
var router = express.Router();
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const emailService = require('../email');
const db = require('../database');

// Hardcoded routes for now, can be moved to DB later
const routes = {
  Website: 'web-team@example.com',
  Email: 'email-team@example.com',
  Social: 'social-team@example.com',
  Admin: 'admin-team@example.com',
  Unclassified: 'support-leads@example.com',
};

// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* POST /api/ticket/initiate */
router.post('/api/ticket/initiate', function(req, res, next) {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required.' });
  }
  res.json({ message: 'Received your query!', query });
});

// POST /api/chat - AI chatbot endpoint
router.post('/api/chat', async function(req, res) {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash-latest',
      systemInstruction: `You are a Support-Triage Assistant. When given a user’s initial query, first classify it into one of [Website, Email, Social, Admin]. Then ask up to 3 clarifying questions to diagnose the issue. End when no further questions are needed.`,
    });
    
    // Convert messages to the format Gemini expects, ensuring it starts with a 'user' role
    const filteredMessages = messages[0]?.role === 'assistant' ? messages.slice(1) : messages;
    
    const history = filteredMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user', // Gemini uses 'model' for assistant
        parts: [{ text: msg.content }],
    }));
    const lastMessage = filteredMessages[filteredMessages.length - 1]?.content;

    if (!lastMessage) {
      return res.status(400).json({ error: 'No user message found.' });
    }

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const aiMessage = { role: 'assistant', content: response.text() };

    // Persist to database
    if (filteredMessages.length === 1) { // First user message
      const { userInfo } = req.body;
      const categoryMatch = aiMessage.content.match(/\[(.*?)\]/);
      const category = categoryMatch ? categoryMatch[1] : 'Unclassified';
      const ticketId = db.addTicket(category, userInfo);
      db.addMessage(ticketId, 'user', lastMessage);
      db.addMessage(ticketId, 'assistant', aiMessage.content);
      aiMessage.ticketId = ticketId; // Send ticketId back to client

      // Send email notification
      const to = routes[category] || routes.Unclassified;
      await emailService.sendEmail({
        to,
        subject: `New Ticket #${ticketId}: ${category}`,
        text: `A new support ticket has been created.\n\nCategory: ${category}\nInitial Query: ${lastMessage}\n\nView ticket: http://localhost:5173/support/${ticketId}`,
      });
    } else {
      const { ticketId } = req.body;
      if (ticketId) {
        db.addMessage(ticketId, 'user', lastMessage);
        db.addMessage(ticketId, 'assistant', aiMessage.content);
      }
    }
    
    res.json({ aiMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI service error.' });
  }
});

// POST /api/ticket/escalate
router.post('/api/ticket/escalate', async (req, res) => {
  const { ticketId } = req.body;
  if (!ticketId) {
    return res.status(400).json({ error: 'Ticket ID is required.' });
  }

  try {
    const ticketInfo = db.getTicketInfo(ticketId);
    const messages = db.getTicketMessages(ticketId);
    const transcript = messages.map(msg => `${msg.role.toUpperCase()}: ${msg.message}`).join('\n');
    
    const emailBody = `
      A user has escalated ticket #${ticketId}.

      User Details:
      Name: ${ticketInfo.user_name}
      Email: ${ticketInfo.user_email}
      Phone: ${ticketInfo.user_phone}

      Conversation Transcript:
      ${transcript}
    `;

    await emailService.sendEmail({
      to: 'meekaaeel@tecbot.co.za',
      subject: `Escalated Ticket #${ticketId} - Priority: ${ticketInfo.priority}`,
      text: emailBody,
    });
    
    db.updateTicketStatus(ticketId, 'escalated');
    res.json({ message: 'Ticket escalated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to escalate ticket.' });
  }
});

// POST /api/ticket/urgent
router.post('/api/ticket/urgent', (req, res) => {
  const { ticketId } = req.body;
  if (!ticketId) {
    return res.status(400).json({ error: 'Ticket ID is required.' });
  }
  
  try {
    db.updateTicketPriority(ticketId, 'urgent');
    res.json({ message: 'Ticket marked as urgent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark ticket as urgent.' });
  }
});

// POST /api/ticket/resolve
router.post('/api/ticket/resolve', async (req, res) => {
  const { ticketId, rating, comment } = req.body;
  if (!ticketId) {
    return res.status(400).json({ error: 'Ticket ID is required.' });
  }

  try {
    db.resolveTicket(ticketId, rating, comment);
    const ticketInfo = db.getTicketInfo(ticketId);
    const messages = db.getTicketMessages(ticketId);
    const transcript = messages.map(msg => `${msg.role.toUpperCase()}: ${msg.message}`).join('\n');

    const emailBody = `
      Ticket #${ticketId} has been resolved and reviewed.

      User Details:
      Name: ${ticketInfo.user_name}
      Email: ${ticketInfo.user_email}
      Phone: ${ticketInfo.user_phone}

      Review:
      Rating: ${rating}/5
      Comment: ${comment}

      Conversation Transcript:
      ${transcript}
    `;

    await emailService.sendEmail({
      to: 'meekaaeel@tecbot.co.za',
      subject: `Resolved Ticket #${ticketId} - ${rating}/5 Stars`,
      text: emailBody,
    });

    res.json({ message: 'Ticket resolved and review submitted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve ticket.' });
  }
});

module.exports = router;
