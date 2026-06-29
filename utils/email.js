const { SendMailClient } = require("zeptomail");
const logger = require("../config/logger");
require("dotenv").config();

const client = new SendMailClient({
  url: process.env.ZEPTO_URL,
  token: process.env.ZEPTO_API_KEY,
});

class EmailService {
  static async sendWelcomeEmail(userEmail, firstName) {
    try {
      const mailData = {
        from: {
          address: process.env.ZEPTO_SENDER_EMAIL,
          name: process.env.ZEPTO_SENDER_NAME,
        },
        to: [{ email_address: { address: userEmail, name: firstName } }],
        subject: "Welcome to Echo!",
        htmlbody: `
          <!DOCTYPE html>
          <html>
          <body>
            <h2>Welcome to Echo, ${firstName}!</h2>
            <p>Thank you for joining our community of voice data contributors.</p>
            <p>Start contributing by recording voice samples and earn rewards!</p>
            <br>
            <p>Best regards,<br>Voice Data Platform Team</p>
          </body>
          </html>
        `,
      };

      const result = await client.sendMail(mailData);
      logger.info("Welcome email sent successfully", { userEmail });
      return { success: true, messageId: result.data.message };
    } catch (error) {
      logger.error("Failed to send welcome email", {
        error: error.message,
        userEmail,
      });
      return { success: false, error: error.message };
    }
  }

  static async sendOTP(userEmail, otp, firstName) {
    try {
      const mailData = {
        from: {
          address: process.env.ZEPTO_SENDER_EMAIL,
          name: process.env.ZEPTO_SENDER_NAME,
        },
        to: [{ email_address: { address: userEmail } }],
        subject: "OTP Request for Validation",
        htmlbody: `
          <!DOCTYPE html>
          <html>
          <body>
            <h2>OTP Request</h2>
            <p>Hi ${firstName},</p>
            <p>Your OTP code is:</p>
            <h1 style="letter-spacing: 4px; color: #007bff;">${otp}</h1>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </body>
          </html>
        `,
      };

      const result = await client.sendMail(mailData);
      logger.info("OTP sent successfully", { userEmail });
      return { success: true, messageId: result.data.message };
    } catch (error) {
      logger.error("Failed to send OTP", { error: error.message, userEmail });
      return { success: false, error: error.message };
    }
  }
  static async sendCustomEmail(userEmail, firstName, subject, htmlbody) {
    try {
      await client.sendMail({
        from: { address: process.env.ZEPTO_SENDER_EMAIL, name: process.env.ZEPTO_SENDER_NAME },
        to: [{ email_address: { address: userEmail, name: firstName } }],
        subject,
        htmlbody,
      });
      logger.info('Custom email sent', { userEmail, subject });
      return { success: true };
    } catch (error) {
      logger.error('Failed to send custom email', { error: error.message, userEmail });
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailService;
