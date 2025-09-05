const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram bot configuration
const TELEGRAM_BOT_TOKEN = '8078550568:AAEtW8cTX3Rw_x1rUIJTg9Q46pntJVfOhuw';
const TELEGRAM_CHAT_ID = '-4795204209';

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for messages
const messageStorage = new Map();

// Health check endpoint
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        server: 'Rustorguo Support Server'
    });
});

// Get message history for user
app.get('/api/messages/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const userMessages = messageStorage.get(userId) || [];
        
        res.json({
            success: true,
            messages: userMessages
        });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Send message to Telegram
app.post('/api/send-message', async (req, res) => {
    try {
        const { userId, userName, userEmail, text, pageUrl } = req.body;

        if (!text || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Message text and user ID are required'
            });
        }

        // Format message for Telegram
        const telegramMessage = `
📨 Новое сообщение от пользователя

👤 Имя: ${userName || 'Гость'}
📧 Email: ${userEmail || 'Не указан'}
💬 Сообщение: ${text}
🌐 Страница: ${pageUrl || 'Неизвестно'}
🆔 User ID: ${userId}
⏰ Время: ${new Date().toLocaleString('ru-RU')}

💡 Чтобы ответить, используйте команду:
/reply_${userId} Ваш ответ здесь
        `.trim();

        // Send to Telegram
        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                chat_id: TELEGRAM_CHAT_ID,
                text: telegramMessage,
                parse_mode: 'HTML'
            },
            { timeout: 10000 }
        );

        // Store user message
        if (!messageStorage.has(userId)) {
            messageStorage.set(userId, []);
        }

        const userMessages = messageStorage.get(userId);
        userMessages.push({
            text: text,
            from: 'user',
            timestamp: new Date().toISOString()
        });

        console.log('Message sent to Telegram for user:', userId);

        res.json({
            success: true,
            message: 'Message sent successfully'
        });

    } catch (error) {
        console.error('Error sending message:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
});

// Endpoint for admin to send replies
app.post('/api/send-reply', async (req, res) => {
    try {
        const { userId, replyText } = req.body;

        if (!userId || !replyText) {
            return res.status(400).json({
                success: false,
                error: 'User ID and reply text are required'
            });
        }

        // Store bot reply
        if (!messageStorage.has(userId)) {
            messageStorage.set(userId, []);
        }

        const userMessages = messageStorage.get(userId);
        userMessages.push({
            text: replyText,
            from: 'bot',
            timestamp: new Date().toISOString(),
            isReply: true
        });

        console.log('Reply saved for user:', userId);

        res.json({
            success: true,
            message: 'Reply sent successfully'
        });

    } catch (error) {
        console.error('Error sending reply:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to send reply'
        });
    }
});

// Check for new replies
app.get('/api/check-replies/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const userMessages = messageStorage.get(userId) || [];
        const newReplies = userMessages.filter(msg => 
            msg.from === 'bot' && !msg.displayed
        );

        // Mark as displayed
        newReplies.forEach(msg => msg.displayed = true);

        res.json({
            success: true,
            hasNewReplies: newReplies.length > 0,
            replies: newReplies
        });

    } catch (error) {
        console.error('Error checking replies:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get all users (for admin panel)
app.get('/api/users', (req, res) => {
    try {
        const users = Array.from(messageStorage.entries()).map(([userId, messages]) => {
            const lastMessage = messages[messages.length - 1];
            return {
                userId,
                messageCount: messages.length,
                lastActivity: lastMessage ? lastMessage.timestamp : null,
                hasUnread: messages.some(msg => msg.from === 'bot' && !msg.displayed)
            };
        });

        res.json({
            success: true,
            users: users
        });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API endpoints:`);
    console.log(`   GET  /api/status`);
    console.log(`   GET  /api/messages/:userId`);
    console.log(`   POST /api/send-message`);
    console.log(`   POST /api/send-reply`);
    console.log(`   GET  /api/check-replies/:userId`);
    console.log(`   GET  /api/users`);
});

module.exports = app;
