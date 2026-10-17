const nodemailer = require('nodemailer');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
  // FIX: don't log the OTP code itself (it ended up in production logs)
  console.log('[Mailer] sendOTP called:', { toEmail, isDev, hasSMTP });
  
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

// ========== NEW: Daily Schedule Email ==========
exports.sendDailyScheduleEmail = async (toEmail, customerName, tickets, customerId) => {
  const jwt = require('jsonwebtoken');
  const unsubUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/customer/unsubscribe?token=${customerId ? jwt.sign({ id: customerId, purpose: 'unsubscribe' }, process.env.JWT_SECRET, { expiresIn: '365d' }) : ''}`;
  console.log('[Mailer] sendDailyScheduleEmail called:', { toEmail, customerName, ticketCount: tickets.length });

  if (isDev && !hasSMTP) {
    console.log('\n========== DEV MODE: DAILY SCHEDULE EMAIL ==========');
    console.log(`To: ${toEmail}`);
    console.log(`Customer: ${customerName}`);
    console.log(`Tickets count: ${tickets.length}`);
    tickets.forEach((t, i) => {
      console.log(`  ${i+1}. Ticket #${t.ticket_id} - ${t.business_name} ${t.queue_number} on ${t.date} ${t.start_time}-${t.end_time} [${t.status_name}]`);
    });
    console.log('==============================================\n');
    return;
  }

  if (!transporter) {
    console.error('[Mailer] ERROR: No transporter available');
    throw new Error('SMTP not configured.');
  }

  // Build HTML table for tickets
  const ticketsHtml = tickets.map((t, i) => `
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        ${esc(t.queue_number)}
      </td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        ${esc(t.business_name)}
      </td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        ${esc(t.date)} ${esc(t.start_time)}-${esc(t.end_time)}
      </td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        ${esc(t.status_name)}
      </td>
    </tr>
  `).join('');

  const mailOptions = {
    from: `"QFlow Daily Schedule" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `Your QFlow Schedule - ${tickets.length} Upcoming Booking${tickets.length !== 1 ? 's' : ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0f766e; text-align: center; padding: 20px 0;">Your Upcoming QFlow Bookings</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 15px; color: #475569;">
            Here are your upcoming bookings for the next 14 days:
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: left;">Ticket</th>
              <th style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: left;">Shop</th>
              <th style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: left;">Date & Time</th>
              <th style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: left;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${ticketsHtml}
          </tbody>
        </table>

        <div style="text-align: center; padding: 20px 0; font-size: 12px; color: #94a3b8;">
          <p>If you no longer wish to receive these daily emails, please update your notification preferences in your customer profile.</p>
        </div>
        <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:16px;">You get this because daily emails are on. <a href="${unsubUrl}">Unsubscribe</a></p>
      </div>
    `,
  };

  console.log('[Mailer] Sending daily schedule email...');
  const result = await transporter.sendMail(mailOptions);
  console.log('[Mailer] Daily schedule email sent:', result.messageId);
};

// ========== NEW: 1-Hour Queue Reminder Email ==========
exports.sendQueueReminderEmail = async (toEmail, customerName, ticket, businessName, startTime, hoursBefore = 1) => {
  const hoursLabel = `${hoursBefore} hour${hoursBefore === 1 ? '' : 's'}`;
  console.log('[Mailer] sendQueueReminderEmail called:', { toEmail, customerName, ticketId: ticket.ticket_id, startTime });

  if (isDev && !hasSMTP) {
    console.log('\n========== DEV MODE: QUEUE REMINDER (' + hoursLabel + ' before) ==========');
    console.log(`To: ${toEmail}`);
    console.log(`Customer: ${customerName}`);
    console.log(`Ticket #${ticket.ticket_id}`);
    console.log(`Shop: ${businessName}`);
    console.log(`Start time: ${startTime}`);
    console.log('===============================================\n');
    return;
  }

  if (!transporter) {
    console.error('[Mailer] ERROR: No transporter available');
    throw new Error('SMTP not configured.');
  }

  const mailOptions = {
    from: `"QFlow Queue Reminder" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `⏰ Your queue starts in ~${hoursLabel} at ${businessName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; border: 2px solid #0f766e; border-radius: 8px; overflow: hidden;">
        
        <div style="background: #0f766e; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Queue Reminder</h2>
          <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Your queue is starting soon</p>
        </div>

        <div style="padding: 30px; text-align: center;">
          <div style="font-size: 48px; color: #0f766e; margin-bottom: 10px;">⏰</div>
          <h1 style="margin: 10px 0; font-size: 24px;">Your queue starts soon!</h1>
          <p style="margin: 10px 0; color: #475569;">You're booked at ${esc(businessName)}</p>
          <p style="margin: 10px 0; font-size: 18px; color: #1e293b;">${esc(startTime)}</p>
        </div>

        <div style="padding: 0 30px 30px 30px;">
          <p style="margin: 0 0 20px 0; color: #475569;">
            Please arrive 10 minutes before your scheduled time. Show this confirmation to staff or present your QR code.
          </p>
          
          <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #64748b;">Ticket Details:</p>
            <p style="margin: 5px 0; font-family: monospace; color: #1e293b;">
              Ticket #${esc(ticket.queue_number)}<br/>
              Date: ${new Date(ticket.date).toLocaleDateString()}<br/>
              Time: ${ticket.start_time?.slice(0, 5)} - ${ticket.end_time?.slice(0, 5)}
            </p>
          </div>
        </div>

        <div style="background: #0f766e; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>© 2026 QFlow. All rights reserved.</p>
          <p>If you have any questions, please contact support.</p>
        </div>
      </div>
    `,
  };

  console.log('[Mailer] Sending queue reminder email...');
  const result = await transporter.sendMail(mailOptions);
  console.log('[Mailer] Queue reminder email sent:', result.messageId);
};
// ========== Ban notice email ==========
function formatMinutes(totalMinutes) {
  const d = Math.floor(totalMinutes / 1440), h = Math.floor((totalMinutes % 1440) / 60), m = totalMinutes % 60;
  return [d && `${d} day${d > 1 ? 's' : ''}`, h && `${h} hour${h > 1 ? 's' : ''}`, m && `${m} minute${m > 1 ? 's' : ''}`]
    .filter(Boolean).join(' ') || '0 minutes';
}

// ban = { tier_name, permanent, duration_minutes, expires_at }
exports.sendBanEmail = async (toEmail, customerName, ban) => {
  const durationText = ban.permanent ? 'Permanent' : formatMinutes(ban.duration_minutes);
  const endsText = ban.permanent
    ? 'This ban does not expire.'
    : `Your ban ends on ${new Date(ban.expires_at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} (Bangkok time).`;

  if (isDev && !hasSMTP) {
    console.log('\n========== DEV MODE: BAN NOTICE EMAIL ==========');
    console.log(`To: ${toEmail}`);
    console.log(`Customer: ${customerName}`);
    console.log(`Ban: ${ban.tier_name} - ${durationText}`);
    console.log(endsText);
    console.log('================================================\n');
    return;
  }

  if (!transporter) throw new Error('SMTP not configured.');

  await transporter.sendMail({
    from: `"QFlow Notice" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `You have been banned from booking on QFlow (${ban.tier_name})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 2px solid #be123c; border-radius: 8px; overflow: hidden;">
        <div style="background: #be123c; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Booking ban</h2>
        </div>
        <div style="padding: 24px; color: #1e293b;">
          <p>Hi ${esc(customerName)},</p>
          <p>You did not show up for your queue, so your account has been restricted from booking.</p>
          <div style="background: #fff1f2; padding: 14px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Level:</strong> ${esc(ban.tier_name)}</p>
            <p style="margin: 4px 0;"><strong>Ban length:</strong> ${esc(durationText)}</p>
            <p style="margin: 4px 0;">${esc(endsText)}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">You can see the time left on your QFlow page. Repeated no-shows lead to longer bans.</p>
        </div>
      </div>
    `,
  });
};

exports.sendShopClosedEmail = async (toEmail, customerName, businessName) => {
  if (isDev && !hasSMTP) { console.log(`[Mailer] DEV: shop-closed notice to ${toEmail} (${businessName})`); return; }
  if (!transporter) throw new Error('SMTP not configured.');
  await transporter.sendMail({
    from: `"QFlow Notice" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `${businessName} is no longer taking bookings on QFlow`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <p>Hi ${esc(customerName)},</p>
      <p><strong>${esc(businessName)}</strong> has been removed from QFlow, so your upcoming booking there is cancelled. If you paid a deposit, please contact the shop about a refund.</p></div>`,
  });
};
