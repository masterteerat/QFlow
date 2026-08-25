const nodemailer = require('nodemailer');

const isDev = process.env.NODE_ENV !== 'production';
const hasSMTP = process.env.SMTP_USER && process.env.SMTP_PASS;

console.log('[Mailer] Config:', { isDev, hasSMTP, user: process.env.SMTP_USER });

let transporter = null;
if (hasSMTP) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  console.log('[Mailer] Transporter created');
}

exports.sendOTP = async (toEmail, otpCode) => {
  console.log('[Mailer] sendOTP called:', { toEmail, otpCode, isDev, hasSMTP });
  
  if (isDev && !hasSMTP) {
    console.log('\n========== DEV MODE: OTP EMAIL ==========');
    console.log(`To: ${toEmail}`);
    console.log(`OTP Code: ${otpCode}`);
    console.log('==========================================\n');
    return;
  }

  if (!transporter) {
    console.error('[Mailer] ERROR: No transporter available');
    throw new Error('SMTP not configured. Set SMTP_USER and SMTP_PASS environment variables.');
  }

  const mailOptions = {
    from: `"QFlow Security" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Your QFlow Login OTP',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        <h2>Your OTP Code</h2>
        <h1 style="color: #0f766e; font-size: 40px; letter-spacing: 5px;">${otpCode}</h1>
        <p>This code expires in 5 minutes. Do not share it with anyone.</p>
      </div>
    `,
  };

  console.log('[Mailer] Sending email...');
  const result = await transporter.sendMail(mailOptions);
  console.log('[Mailer] Email sent:', result.messageId);
};