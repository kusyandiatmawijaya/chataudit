import axios from 'axios';
import { API_BASE_URL } from '../config';

/**
 * Sends an email using the backend API.
 * Never stores SMTP credentials in the frontend.
 * 
 * @param {Object} payload 
 * @param {string} payload.to Recipient email address
 * @param {string} payload.subject Email subject
 * @param {string} [payload.html] HTML content
 * @param {string} [payload.text] Text content
 * @param {string} [payload.templateName] Optional template name (e.g., 'testEmail')
 * @param {Object} [payload.templateData] Data for the template
 */
export const sendEmail = async (payload) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_BASE_URL}/api/email/send`, payload, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error sending email:', error);
        if (error.response && error.response.data) {
            throw new Error(error.response.data.message || 'Gagal mengirim email');
        }
        throw new Error('Terjadi kesalahan saat mengirim email');
    }
};
