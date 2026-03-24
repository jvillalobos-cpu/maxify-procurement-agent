/**
 * Maxify Procurement Agent — API Server
 * 
 * Express API that handles quote requests, order management,
 * and supplier integrations for the Maxia calculator platform.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const brevo = require('../adapters/brevo');

const app = express();
const PORT = process.env.PORT || 3000;

// Logger
const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console({ format: format.combine(format.colorize(), format.simple()) }),
    ],
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: [
        'https://gomaxify.com',
        'https://solar-tech.solarandroof.pro',
        'https://solana.solarandroof.pro',
        'http://localhost:*',
    ],
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'maxify-procurement-agent',
        version: require('../../package.json').version,
        timestamp: new Date().toISOString(),
    });
});

// API Routes
// TODO: Import route modules as they are built
// app.use('/api/v1/quotes', require('./routes/quotes'));
// app.use('/api/v1/orders', require('./routes/orders'));
// app.use('/api/v1/suppliers', require('./routes/suppliers'));
// app.use('/api/v1/products', require('./routes/products'));

// Placeholder routes
app.post('/api/v1/quotes/request', async (req, res) => {
    const { bom, jobSite, preferences } = req.body;

    // Handle lead notification via Brevo
    try {
        const leadName = `${preferences.firstName || 'Solar'} ${preferences.lastName || 'Lead'}`;
        await brevo.sendEmail({
            to: [{ email: process.env.NOTIFICATION_FROM || 'solana@solarandroof.pro', name: 'Solana Team' }],
            subject: `[New Quote Request] ${jobSite.address}`,
            htmlContent: `
                <h3>New Quote Request from Build My Offer</h3>
                <p><strong>Address:</strong> ${jobSite.address}</p>
                <p><strong>System Size:</strong> ${bom.panels?.[0]?.watts * bom.panels?.[0]?.count / 1000 || 'N/A'} kW</p>
                <p><strong>Roofing Included:</strong> ${preferences.includeRoofing ? 'Yes' : 'No'}</p>
                <hr>
                <p>Check the procurement dashboard for details.</p>
            `
        });
    } catch (e) {
        logger.warn('Failed to send quote notification email:', e.message);
    }

    res.status(201).json({
        quoteId: `qt_${Date.now()}`,
        status: 'quoting',
        suppliersQueried: 0,
        estimatedCompletionTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        message: 'Procurement agent is in development. Quote request recorded and notifications sent.',
    });
});

/**
 * Lead Capture Endpoint
 * Receives leads from website forms and triggers Brevo notifications.
 */
app.post('/api/v1/leads', async (req, res) => {
    const lead = req.body;
    
    if (!lead.email || !lead.firstName) {
        return res.status(400).json({ error: 'First name and email are required.' });
    }

    const source = lead.source || 'Website';
    const service = lead.service || 'General Assessment';
    const category = service !== 'General Assessment' ? service : source;
    
    logger.info(`[Lead Captured] ${lead.firstName} ${lead.lastName || ''} (${category})`);

    const results = { email: null, sms: null };

    // 1. Send Welcome Email to Lead
    try {
        results.email = await brevo.sendEmail({
            to: [{ email: lead.email, name: lead.firstName }],
            subject: `Your Solana ${service} Request`,
            htmlContent: `
                <div style="font-family: sans-serif; color: #1a1a2e;">
                    <h2 style="color: #c8a84b;">Welcome to the Future of Energy</h2>
                    <p>Hi ${lead.firstName},</p>
                    <p>Thank you for requesting a <strong>${service}</strong> from Solana Energy Concepts. One of our Energy Architects will review your property and reach out within 24 hours.</p>
                    <hr>
                    <p style="font-size: 12px; color: #888;">Solana Energy Concepts — 18 Years of Excellence in AZ</p>
                </div>
            `
        });
    } catch (e) {
        logger.error('Brevo Email Failed:', e.message);
    }

    // 2. Notify Solana Team (Email + Optional SMS)
    try {
        await brevo.sendEmail({
            to: [{ email: process.env.NOTIFICATION_FROM || 'solana@solarandroof.pro', name: 'Solana Team' }],
            subject: `[New Lead - ${category}] ${lead.firstName} ${lead.lastName || ''}`,
            htmlContent: `
                <h3>New Lead Captured</h3>
                <p><strong>Category:</strong> ${category}</p>
                <p><strong>Name:</strong> ${lead.firstName} ${lead.lastName || ''}</p>
                <p><strong>Email:</strong> ${lead.email}</p>
                <p><strong>Phone:</strong> ${lead.phone || 'N/A'}</p>
                <p><strong>Source:</strong> ${source}</p>
                <p><strong>Message:</strong> ${lead.message || lead.customFields?.message || 'N/A'}</p>
                <hr>
                <p>Generated at: ${new Date().toLocaleString()}</p>
            `
        });

        // Notify Team via SMS if enabled
        if (lead.phone && process.env.NOTIFICATION_PHONE) {
            await brevo.sendSMS({
                recipient: process.env.NOTIFICATION_PHONE,
                content: `Solana Lead: ${lead.firstName} interested in ${lead.service || 'Solar'}. Ph: ${lead.phone}`
            });
        }
    } catch (e) {
        logger.error('Team Notification Failed:', e.message);
    }

    res.json({ success: true, message: 'Lead recorded and notifications triggered.', results });
});

app.get('/api/v1/quotes/:id', (req, res) => {
    res.json({
        quoteId: req.params.id,
        status: 'pending',
        message: 'Procurement agent is in development.',
    });
});

app.get('/api/v1/suppliers', (req, res) => {
    res.json({
        suppliers: [
            { name: 'Fortune Energy', type: 'email', status: 'planned', regions: ['CA', 'AZ', 'TX', 'NJ'] },
            { name: 'Krannich Solar', type: 'portal', status: 'planned', regions: ['TX', 'FL', 'CA', 'NJ'] },
            { name: 'BayWa r.e.', type: 'portal', status: 'planned', regions: ['nationwide'] },
            { name: 'Soligent', type: 'portal', status: 'planned', regions: ['nationwide'] },
            { name: 'GreenTech Renewables', type: 'email', status: 'planned', regions: ['nationwide'] },
            { name: 'RENVU', type: 'ecommerce', status: 'planned', regions: ['nationwide'] },
            { name: 'CivicSolar', type: 'email', status: 'planned', regions: ['nationwide'] },
            { name: 'Wesco', type: 'api', status: 'planned', regions: ['nationwide'] },
        ],
    });
});

app.get('/api/v1/products/search', (req, res) => {
    const { q, category, page = 1, limit = 20 } = req.query;

    // TODO: Query maxia_equipment.db
    res.json({
        results: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        message: 'Connect to maxia_equipment.db (23,704 CEC/NREL records)',
    });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    logger.info(`Maxify Procurement Agent API running on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
