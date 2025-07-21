const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.resolve('tickets.db'), { verbose: console.log });

const createTables = () => {
  const ticketsTable = `
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT,
      user_email TEXT,
      user_phone TEXT,
      category TEXT,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      rating INTEGER,
      review_comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const messagesTable = `
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER,
      role TEXT,
      message TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    );
  `;
  db.exec(ticketsTable);
  db.exec(messagesTable);
};

createTables();

const addTicket = (category, userInfo) => {
  const { name, email, phone } = userInfo;
  const stmt = db.prepare('INSERT INTO tickets (category, user_name, user_email, user_phone) VALUES (?, ?, ?, ?)');
  const info = stmt.run(category, name, email, phone);
  return info.lastInsertRowid;
};

const addMessage = (ticket_id, role, message) => {
  const stmt = db.prepare('INSERT INTO ticket_messages (ticket_id, role, message) VALUES (?, ?, ?)');
  stmt.run(ticket_id, role, message);
};

const getTicketInfo = (ticket_id) => {
  const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
  return stmt.get(ticket_id);
};

const getTicketMessages = (ticket_id) => {
  const stmt = db.prepare('SELECT role, message, timestamp FROM ticket_messages WHERE ticket_id = ? ORDER BY timestamp ASC');
  return stmt.all(ticket_id);
};

const updateTicketStatus = (ticket_id, status) => {
  const stmt = db.prepare('UPDATE tickets SET status = ? WHERE id = ?');
  stmt.run(status, ticket_id);
};

const updateTicketPriority = (ticket_id, priority) => {
  const stmt = db.prepare('UPDATE tickets SET priority = ? WHERE id = ?');
  stmt.run(priority, ticket_id);
};

const resolveTicket = (ticket_id, rating, comment) => {
  const stmt = db.prepare('UPDATE tickets SET status = ?, rating = ?, review_comment = ? WHERE id = ?');
  stmt.run('resolved', rating, comment, ticket_id);
};

module.exports = {
  addTicket,
  addMessage,
  getTicketInfo,
  getTicketMessages,
  updateTicketStatus,
  updateTicketPriority,
  resolveTicket,
}; 