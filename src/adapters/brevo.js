/**
 * Brevo Adapter
 * 
 * Handles multi-channel communications (Email, SMS, WhatsApp) via Brevo API.
 */

const axios = require('axios');

class BrevoAdapter {
    constructor() {
        this.apiKey = process.env.BREVO_API_KEY;
        this.baseUrl = 'https://api.brevo.com/v3';
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'api-key': this.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Send Transactional Email
     * @param {Object} data { to: [{email, name}], subject, htmlContent, sender: {name, email} }
     */
    async sendEmail(data) {
        if (!this.apiKey) {
            console.warn('[Brevo] API Key missing. Skipping email.');
            return { skipped: true };
        }

        try {
            const response = await this.client.post('/smtp/email', {
                sender: data.sender || { name: 'Solana Energy Concepts', email: 'solana@solarandroof.pro' },
                to: data.to,
                subject: data.subject,
                htmlContent: data.htmlContent
            });
            return response.data;
        } catch (error) {
            this._handleError('Email', error);
        }
    }

    /**
     * Send Transactional SMS
     * @param {Object} data { recipient, content, sender }
     */
    async sendSMS(data) {
        if (!this.apiKey) {
            console.warn('[Brevo] API Key missing. Skipping SMS.');
            return { skipped: true };
        }

        try {
            const response = await this.client.post('/transactionalSMS/sms', {
                type: 'transactional',
                sender: data.sender || 'Solana',
                recipient: data.recipient,
                content: data.content
            });
            return response.data;
        } catch (error) {
            this._handleError('SMS', error);
        }
    }

    /**
     * Send WhatsApp Message (requires validated template)
     * @param {Object} data { recipient, templateId, params }
     */
    async sendWhatsApp(data) {
        if (!this.apiKey) {
            console.warn('[Brevo] API Key missing. Skipping WhatsApp.');
            return { skipped: true };
        }

        try {
            const response = await this.client.post('/whatsapp/sendMessage', {
                senderNumber: process.env.BREVO_WHATSAPP_NUMBER,
                recipientNumber: data.recipient,
                templateId: data.templateId,
                params: data.params
            });
            return response.data;
        } catch (error) {
            this._handleError('WhatsApp', error);
        }
    }

    _handleError(type, error) {
        const message = error.response ? error.response.data : error.message;
        console.error(`[Brevo ${type} Error]:`, message);
        throw new Error(`Brevo ${type} failed: ${JSON.stringify(message)}`);
    }
}

module.exports = new BrevoAdapter();
