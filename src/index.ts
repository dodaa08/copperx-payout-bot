import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const token = process.env.Tbot_token
if (!token) {
  throw new Error('BOT TOKEN is missing in the environment variables.');
}

console.log(token);

const bot = new TelegramBot(token, { polling: true });

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome to the Copperx Payout Bot! Use /otp <email> to request an OTP.');
});

interface UserSession {
  sid: string;
  email: string;
}

const userSessions: Record<number, UserSession> = {};

bot.onText(/\/otp (.+)/, async (msg, match) => {
  const email = match?.[1];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bot.sendMessage(msg.chat.id, '❌ Invalid email. Use: /otp <email>');
  }

  try {
    const response = await axios.post(
      'https://income-api.copperx.io/api/auth/email-otp/request',
      { email },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (response.status === 200 && response.data.sid) {
      userSessions[msg.chat.id] = { sid: response.data.sid, email };
      bot.sendMessage(msg.chat.id, `✅ OTP sent to ${email}. Use /verify <otp>.`);
    } else {
      bot.sendMessage(msg.chat.id, '❌ Failed to send OTP.');
    }
  } catch (error: any) {
    console.error('Error sending OTP:', error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, '❌ Error requesting OTP. Please try again.');
  }
});

bot.onText(/\/verify (.+)/, async (msg, match) => {
  const otp = match?.[1];
  const session = userSessions[msg.chat.id];
  
  console.log("User Details "+otp, session.sid, session.email);

  if (!otp || !session) {
    return bot.sendMessage(msg.chat.id, '❌ Invalid OTP or no session found. Request OTP again.');
  }

  try {
    const response = await axios.post(
      'https://income-api.copperx.io/api/auth/email-otp/authenticate',
      {
        otp,
        sid: session.sid,
        email: session.email,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('OTP Request Response:', response.data);

    if (response.status === 200 && response.data.token) {
      bot.sendMessage(msg.chat.id, '✅ OTP verified successfully!');
      delete userSessions[msg.chat.id]; // Clear session after successful verification
    } else {
      bot.sendMessage(msg.chat.id, '❌ Invalid OTP. Try again.');
    }
  } catch (error: any) {
    console.error('Error verifying OTP:', error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, '❌ Error verifying OTP. Please try again.');
    delete userSessions[msg.chat.id];
  }


  
});


console.log('🚀 Telegram bot is running...');