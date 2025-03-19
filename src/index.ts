import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.Tbot_token;
if (!token) {
  throw new Error('BOT TOKEN is missing in the environment variables.');
}

console.log(`Token :  ${token}`);
console.log(`Start using the bot...`);

const bot = new TelegramBot(token, { polling: true });

interface UserSession {
  sid: string;
  email: string;
  accessToken?: string; // Added access token
}

const userSessions: Record<number, UserSession> = {};

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome to the Copperx Payout Bot! Use /otp <email> to request an OTP.');
});

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

  if (!otp) {
    return bot.sendMessage(msg.chat.id, '❌ Invalid OTP. Use /verify <otp>');
  }

  if (!session) {
    return bot.sendMessage(msg.chat.id, '❌ No OTP request found. Use /otp <email> first.');
  }

  try {
    const response = await axios.post(
      'https://income-api.copperx.io/api/auth/email-otp/authenticate',
      { email: session.email, otp: otp, sid: session.sid },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (response.status === 200 && response.data.accessToken) {
      userSessions[msg.chat.id].accessToken = response.data.accessToken; // Store access token
      bot.sendMessage(msg.chat.id, '✅ OTP verified successfully!');
    } else {
      bot.sendMessage(msg.chat.id, '❌ OTP verification failed.');
    }
  } catch (error: any) {
    console.error('Error verifying OTP:', error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, '❌ Error verifying OTP. Please try again.');
  }
});

bot.onText(/\/me/, async (msg) => {
  const session = userSessions[msg.chat.id];

  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }


  try {
    const response = await axios.get("https://income-api.copperx.io/api/auth/me", {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}` // Include access token
      }
    });

    if (response.status === 200) {
      console.log(response);
      const userData = response.data;

      // Handling null or undefined values
      const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'N/A';
      const email = userData.email || 'N/A';
      const role = userData.role || 'N/A';

      bot.sendMessage(
        msg.chat.id,
        `✅ User Info:\nName: ${userName}\nEmail: ${email}\nRole: ${role}`
      );
    } else {
      bot.sendMessage(msg.chat.id, '❌ Failed to fetch user info.');
    }

  } catch (error : any) {
    console.error('Error fetching user info:', error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, '❌ Error fetching user info. Please try again.');
  }
});






// wallets

bot.onText(/\/wallets/, async (msg) => {
  const session = userSessions[msg.chat.id];

  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  try {
    const response = await axios.get("https://income-api.copperx.io/api/wallets", {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}` // Include access token
      }
    });

    const wallets = response.data;

    if (wallets.length === 0) {
      return bot.sendMessage(msg.chat.id, '❌ No wallets found.');
    }

    const walletList = wallets
      .map((wallet : any ) => `💼 Wallet Address: ${wallet.walletAddress}\nNetwork: ${wallet.network}\nType: ${wallet.walletType}\n`)
      .join('\n--------------------\n');

    bot.sendMessage(msg.chat.id, `✅ Your Wallets:\n\n${walletList}`);
  } catch (error : any) {
    console.error('Error fetching wallets:', error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, '❌ Error fetching wallets. Please try again.');
  }
});

bot.onText(/\/balances/, async (msg) => {
  const session = userSessions[msg.chat.id];

  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  try {
    const response = await axios.get("https://income-api.copperx.io/api/wallets/balances", {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}` // Include access token
      }
    });

    const wallets = response.data; // API returns an array of wallets
    if (!wallets.length) {
      return bot.sendMessage(msg.chat.id, '❌ No wallets found.');
    }

    let WalletBalance = "✅ Your Wallet Balances:\n\n";

    wallets.forEach((wallet: any) => {
      WalletBalance += `💼 Wallet Network: ${wallet.network}\n`;

      if (!wallet.balances.length) {
        WalletBalance += `  - No balances found.\n`;
      } else {
        wallet.balances.forEach((x: any) => {
          WalletBalance += `  - ${x.symbol}: ${x.balance} (${x.decimals} decimals)\n`;
        });
      }

      WalletBalance += "--------------------\n";
    });

    bot.sendMessage(msg.chat.id, WalletBalance);
  } catch (error: any) {
    console.error('Error fetching balances:', error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, '❌ Error fetching balances. Please try again.');
  }
});







bot.onText(/\/generate_wallet (\d+)/, async (msg, match) => {
  const session = userSessions[msg.chat.id];

  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  const network = match?.[1]; // Extract the network ID from the command

  try {
    const response = await axios.post(
      'https://income-api.copperx.io/api/wallets',
      { network }, // Payload
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (response.status === 200) {
      const wallet = response.data;
      bot.sendMessage(
        msg.chat.id,
        `✅ Wallet Generated:\n\nWallet Address: ${wallet.walletAddress}\nNetwork: ${wallet.network}\nType: ${wallet.walletType}`
      );
    } else {
      bot.sendMessage(msg.chat.id, '❌ Failed to generate wallet.');
    }
  } catch (error: any) {
    console.error('Error generating wallet:', error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, '❌ Error generating wallet. Please try again.');
  }
});



bot.onText(/\/default (.+)/, async (msg, match) => {
  const session = userSessions[msg.chat.id];

  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  if (!match || !match[1]) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please provide a wallet ID. Example: /default wallet_123');
  }

  const walletId = match[1].trim(); // Extract and clean the wallet ID
  if (!/^wallet_[a-zA-Z0-9]+$/.test(walletId)) {
    return bot.sendMessage(msg.chat.id, "⚠️ Invalid wallet ID format. Example: /default wallet_123");
  }
  try {
    const response = await axios.post("https://income-api.copperx.io/api/wallets/default", 
      { walletId }, 
      { 
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        }
      }
    );

    bot.sendMessage(msg.chat.id, `✅ Wallet ID set to default: ${walletId}\nWallet Address: ${response.data.walletAddress}`);
  } catch (error : any) {
    console.error(`Error: ${error.response?.data?.error || error.message}`);
    bot.sendMessage(msg.chat.id, `❌ Error setting default wallet: ${error.response?.data?.error || error.message}`);
  }
});





bot.onText(/\/default/, async (msg)=>{
  const session = userSessions[msg.chat.id];
  if(!session || !session.accessToken){
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }
  
  try{
    const response = await axios.get("https://income-api.copperx.io/api/wallets/default", 
      { 
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        }
      }
    );

    const wallet = response.data;
    bot.sendMessage(msg.chat.id, `Default Wallet ${wallet.id}, Address : ${wallet.Address}`);
  }
  catch(error){

    bot.sendMessage(msg.chat.id, `Error : ${error}`);
  }
});




