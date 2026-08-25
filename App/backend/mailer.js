const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendOTP = async (toEmail, otpCode) => {
  const mailOptions = {
    from: `"QFlow Security" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'รหัส OTP สำหรับเข้าสู่ระบบ QFlow',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        <h2>รหัส OTP ของคุณคือ</h2>
        <h1 style="color: #0f766e; font-size: 40px; letter-spacing: 5px;">${otpCode}</h1>
        <p>รหัสนี้จะหมดอายุภายใน 5 นาที ห้ามให้รหัสนี้กับบุคคลอื่นเด็ดขาด</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};