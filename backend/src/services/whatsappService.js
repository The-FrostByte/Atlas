import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const WHATSAPP_FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'}`;

// Porting your Python WHATSAPP_TEMPLATES
const TEMPLATES = {
  otp: "🔐 Your Atlas verification code is: {otp}\n\nThis code expires in 10 minutes.",
  task_assigned: "📋 *New Work Item Assigned*\n\nItem: {title}\nPriority: {priority}\nDue: {due_date}",
  task_completed: "✅ *Work Item Completed*\n\nItem: {title}\nCompleted by: {completed_by}"
};

export const sendWhatsApp = async (to, type, data) => {
  if (!client) {
    console.warn('[WHATSAPP] Twilio not configured, skipping message.');
    return { success: false, error: 'Twilio not configured' };
  }

  let body = TEMPLATES[type] || "📬 New notification from Atlas.";

  // Replace placeholders {key} with actual data values
  Object.keys(data).forEach(key => {
    body = body.replace(`{${key}}`, data[key]);
  });

  try {
    const message = await client.messages.create({
      body,
      from: WHATSAPP_FROM,
      to: `whatsapp:${to.replace(/\s/g, '')}` // Clean spaces
    });
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('[WHATSAPP] Error:', error.message);
    return { success: false, error: error.message };
  }
};