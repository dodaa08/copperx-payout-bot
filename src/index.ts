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

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome to the Copperx Payout Bot! Use /otp <email> to request an OTP.');
});

bot.onText(/\/otp (.+)/, async (msg, match) => {
  const email = match?.[1];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bot.sendMessage(msg.chat.id, 'Usage: /otp <valid-email>');
  }

  try {
    const response = await axios.post(
      'https://income-api.copperx.io/api/auth/email-otp/request',
      { email },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    bot.sendMessage(
      msg.chat.id,
      response.status === 200
        ? `OTP sent to ${email}. Use /verify <otp>`
        : 'Failed to send OTP.'
    );
  } catch (error: any) {
    console.error('Error sending OTP:', error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, 'Error requesting OTP. Please try again.');
  }
});

bot.onText(/\/verify (.+)/, async (msg, match) => {
  const otp = match?.[1];

  if (!otp) {
    return bot.sendMessage(msg.chat.id, 'Usage: /verify <otp>');
  }

  try {
    const response = await axios.post(
      'https://income-api.copperx.io/api/auth/email-otp/authenticate',
      { otp },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (response.status === 200 && response.data.token) {
      bot.sendMessage(msg.chat.id, '✅ Authentication successful! Token secured.');
      // Store the token securely here (e.g., Redis or session)
    } else {
      bot.sendMessage(msg.chat.id, '❌ Invalid OTP. Try again.');
    }
  } catch (error: any) {
    console.error('Error verifying OTP:', error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, 'Error verifying OTP. Please try again. Create an Account on coppperx if you have not yet.');
  }
});

console.log('🚀 Telegram bot is running...');