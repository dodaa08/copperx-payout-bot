import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.Tbot_token;
if (!token) {
  throw new Error('BOT TOKEN is missing in the environment variables.');
}

console.log(`Token: ${token}`);
console.log('Starting the bot...');

const bot = new TelegramBot(token, { polling: true });

interface UserSession {
  sid: string;
  email: string;
  accessToken?: string;
}

const userSessions: Record<number, UserSession> = {};

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// ============================================================================
// Authentication APIs
// ============================================================================

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
      userSessions[msg.chat.id].accessToken = response.data.accessToken;
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
        'Authorization': `Bearer ${session.accessToken}`
      }
    });

    if (response.status === 200) {
      const userData = response.data;
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
  } catch (error: any) {
    console.error('Error fetching user info:', error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, '❌ Error fetching user info. Please try again.');
  }
});

// ============================================================================
// Wallet APIs
// ============================================================================

bot.onText(/\/wallets/, async (msg) => {
  const session = userSessions[msg.chat.id];

  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  try {
    const response = await axios.get("https://income-api.copperx.io/api/wallets", {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`
      }
    });

    const wallets = response.data;
    if (wallets.length === 0) {
      return bot.sendMessage(msg.chat.id, '❌ No wallets found.');
    }

    const walletList = wallets
      .map((wallet: any) => `💼 Wallet Address: ${wallet.walletAddress}\nNetwork: ${wallet.network}\nType: ${wallet.walletType}\n`)
      .join('--------------------\n');

    bot.sendMessage(msg.chat.id, `✅ Your Wallets:\n\n${walletList}`);
  } catch (error: any) {
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
        'Authorization': `Bearer ${session.accessToken}`
      }
    });

    const wallets = response.data;
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

// bot.onText(/\/generate_wallet (\d+)/, async (msg, match) => {
//   const session = userSessions[msg.chat.id];

//   if (!session || !session.accessToken) {
//     return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
//   }

//   const network = match?.[1];

//   try {
//     const response = await axios.post(
//       'https://income-api.copperx.io/api/wallets',
//       { network },
//       {
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${session.accessToken}`,
//         },
//       }
//     );

//     if (response.status === 200) {
//       const wallet = response.data;
//       bot.sendMessage(
//         msg.chat.id,
//         `✅ Wallet Generated:\n\nWallet Address: ${wallet.walletAddress}\nNetwork: ${wallet.network}\nType: ${wallet.walletType}`
//       );
//     } else {
//       bot.sendMessage(msg.chat.id, '❌ Failed to generate wallet.');
//     }
//   } catch (error: any) {
//     console.error('Error generating wallet:', error.response?.data || error.message);
//     bot.sendMessage(msg.chat.id, '❌ Error generating wallet. Please try again.');
//   }
// });

bot.onText(/\/default (.+)/, async (msg, match) => {
  const session = userSessions[msg.chat.id];

  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  if (!match || !match[1]) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please provide a wallet ID. Example: /default wallet_123');
  }

  const walletId = match[1].trim();
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
  } catch (error: any) {
    console.error(`Error: ${error.response?.data?.error || error.message}`);
    bot.sendMessage(msg.chat.id, `❌ Error setting default wallet: ${error.response?.data?.error || error.message}`);
  }
});

bot.onText(/\/default/, async (msg) => {
  const session = userSessions[msg.chat.id];
  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  try {
    const response = await axios.get("https://income-api.copperx.io/api/wallets/default",
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        }
      }
    );

    const wallet = response.data;
    bot.sendMessage(msg.chat.id, `Default Wallet ${wallet.id}, Address: ${wallet.Address}`);
  } catch (error) {
    bot.sendMessage(msg.chat.id, `Error: ${error}`);
  }
});

// ============================================================================
// KYC APIs
// ============================================================================

bot.onText(/\/kycs/, async (msg) => {
  const session = userSessions[msg.chat.id];
  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }
  const page = 1;
  const limit = 10;

  try {
    const response = await axios.get(`https://income-api.copperx.io/api/kycs?page=${page}&limit=${limit}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        }
      }
    );

    const { data } = response.data;
    if (!data || data.length === 0) {
      return bot.sendMessage(msg.chat.id, 'ℹ️ No KYC records found.');
    }

    let message = '📄 *KYC Records*:\n\n';
    data.forEach((kyc: any, index: any) => {
      message += `🔹 *KYC ${index + 1}:*\n`;
      message += `- 🏷 Status: ${kyc.status}\n`;
      message += `- 🌍 Country: ${kyc.country}\n`;
      message += `- 🔎 Provider: ${kyc.kycProviderCode}\n`;
      message += `- 🆔 Verification Status: ${kyc.kycDetail?.currentKycVerification?.status || "N/A"}\n`;
      message += `- 👤 Name: ${kyc.kycDetail?.firstName || "N/A"} ${kyc.kycDetail?.lastName || ""}\n`;
      message += `- 📧 Email: ${kyc.kycDetail?.email || "N/A"}\n`;
      message += `- 📞 Phone: ${kyc.kycDetail?.phoneNumber || "N/A"}\n`;
      message += `- 🏡 Address: ${kyc.kycDetail?.addressLine1 || "N/A"}, ${kyc.kycDetail?.city || "N/A"}, ${kyc.kycDetail?.state || "N/A"}, ${kyc.kycDetail?.country || "N/A"}\n`;

      if (kyc.kycDetail?.kycDocuments && kyc.kycDetail.kycDocuments.length > 0) {
        message += `- 📜 Documents:\n`;
        kyc.kycDetail.kycDocuments.forEach((doc: any) => {
          message += `  - 📄 Type: ${doc.documentType}, Status: ${doc.status}\n`;
        });
      }

      if (kyc.kycDetail?.kycUrl) {
        message += `- 🔗 [View KYC Details](${kyc.kycDetail.kycUrl})\n`;
      }
      message += `\n`;
    });

    bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
  } catch (error) {
    console.log(`Error: ${error}`);
    bot.sendMessage(msg.chat.id, `Error: ${error}`);
  }
});

// ============================================================================
// Transfer APIs
// ============================================================================

bot.onText(/\/transfers(?:\s(.+))?/, async (msg, match: any) => {
  console.log("Received message:", msg.text);
  
  const session = userSessions[msg.chat.id];
  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  let queries: any = { page: 1, limit: 10 };
  if (match?.[1]) {
    console.log("User provided parameters:", match[1]);
    const args = match[1].split(" ");
    args.forEach((arg: string) => {
      const [key, value] = arg.split("=");
      if (key && value) {
        queries[key] = isNaN(Number(value)) ? value : Number(value);
      }
    });
  }

  console.log("Final API query parameters:", queries);

  try {
    const response = await axios.get("https://income-api.copperx.io/api/transfers", {
      params: queries,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    console.log("API Response Data:", response.data);
    const transfers = response.data;

    if (!transfers.length) {
      return bot.sendMessage(msg.chat.id, "⚠️ No transfers found.");
    }

    let message = "📜 *Recent Transfers:*\n";
    transfers.forEach((tx: any, index: number) => {
      message += `\n🔹 *Tx ${index + 1}:*\n`;
      message += `- 🏛 From: ${tx.sourceCountry} → ${tx.destinationCountry}\n`;
      message += `- 💰 Amount: ${tx.amount} ${tx.currency}\n`;
      message += `- 🔄 Type: ${tx.type}\n`;
      message += `- ✅ Status: ${tx.status}\n`;
      message += `- 📅 Date: ${tx.date}\n`;
    });

    bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error fetching transfers:", error);
    bot.sendMessage(msg.chat.id, '❌ Error fetching transfers.');
  }
});



bot.onText(/\/Email_Transfer (.+)/, async (msg, match : any) => {
  const session = userSessions[msg.chat.id];
  
  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  const args = match[1].split(" ");
  if (args.length < 6) {
    return bot.sendMessage(msg.chat.id, '⚠️ Incorrect usage. Use:\n/send <walletAddress> <email> <payeeId> <amount> <purposeCode> <currency>');
  }

  const [walletAddress, email, payeeId, amount, purposeCode, currency] = args;

  try {
    const response = await axios.post(
      "https://income-api.copperx.io/api/transfers/send",
      {
        walletAddress,
        email,
        payeeId,
        amount,
        purposeCode,
        currency,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    const message = await response.data;

    bot.sendMessage(msg.chat.id, `Status : ${message.status} \n fromC : ${message.sourceCountry}} \n toC : ${message.destinationCountry} \n Amount : ${message.amount} \n Currency : ${message.currency} `);

  } catch (error : any) {
    console.error("Error:", error.response ? error.response.data : error.message);
    bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/wallet_Transfer\s+(.+)/, async (msg, match: any) => {
  const session = userSessions[msg.chat.id];

  // Check if session is valid
  if (!session || !session.accessToken) {
    bot.sendMessage(msg.chat.id, "Session expired. Please authenticate again.");
    return;
  }

 

  const params = match[1].trim().split(/\s+/);

  // Check for all required parameters
  if (params.length < 4) {
    bot.sendMessage(msg.chat.id, "Missing parameters. Use: \n/wallet_Transfer <walletAddress> <amount> <purposeCode> <currency>");
    return;
  }

  const [walletAddress, amount, purposeCode, currency] = params;


  bot.sendMessage(msg.chat.id, `Processing withdrawal:
  - Wallet: ${walletAddress}
  - Amount: ${amount}
  - Purpose Code: ${purposeCode}
  - Currency: ${currency}`);

  try {
    const response = await axios.post(
      "https://income-api.copperx.io/api/transfers/wallet-withdraw",
      { walletAddress, amount, purposeCode, currency },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    const message = response.data;
    bot.sendMessage(msg.chat.id, `✅ Status: ${message.status}\n💰 Amount: ${message.amount}\n💱 Currency: ${message.currency}`);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      // Handle API-specific errors
      const status = error.response.status;
      const errorData = error.response.data;

      if (status === 404 || (errorData?.message && errorData.message.includes("wallet"))) {
        bot.sendMessage(msg.chat.id, "❌ Error: The wallet address does not exist. Please check and try again.");
      } else if (status === 400) {
        bot.sendMessage(msg.chat.id, `❌ Error: Invalid request - ${errorData?.message || "Bad parameters"}`);
      } else if (status === 401) {
        bot.sendMessage(msg.chat.id, "❌ Error: Authentication failed. Please re-authenticate.");
      } else {
        bot.sendMessage(msg.chat.id, `❌ Error: ${errorData?.message || "Something went wrong"}`);
        console.log("Error message "+error.message);
      }
      console.error("API error:", status, errorData);
    } else if (error instanceof Error) {
      // Generic errors (e.g., network issues)
      console.error("Withdrawal error:", error.message);
      bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
      console.log("Error message "+error.message);
    } else {
      // Unknown errors
      console.error("Unknown error:", error);
      bot.sendMessage(msg.chat.id, "❌ An unknown error occurred. Please try again.");
    }
  }
  
});



// bot.onText(/\/offramp (.+)/, async (msg, match : any) => {
//   const chatId = msg.chat.id;
//   const session = userSessions[chatId];

//   if (!session || !session.accessToken) {
//     return bot.sendMessage(chatId, `No active session found. Please authenticate first.`);
//   }

//   try {
//     const input = match[1].trim();

//     // Extract customerData
//     const customerDataMatch = input.match(/({.*})/);
//     if (!customerDataMatch) {
//       return bot.sendMessage(chatId, `Invalid customerData format. Please enclose in {}.`);
//     }
//     const customerDataStr = customerDataMatch[0];
//     let remainingInput = input.replace(customerDataStr, "").trim();

//     // Extract note (optional)
//     const noteMatch = remainingInput.match(/"([^"]+)"/);
//     let note = noteMatch ? noteMatch[1] : null;
//     if (noteMatch) {
//       remainingInput = remainingInput.replace(`"${note}"`, "").trim();
//     }

//     // Split remaining parameters
//     const otherParams = remainingInput.split(/\s+/).filter(Boolean);
//     if (otherParams.length !== 9) {
//       return bot.sendMessage(chatId, `Invalid format. Expected 9 params + customerData + optional note. Got ${otherParams.length}: ${otherParams.join(", ")}`);
//     }

//     const [invoiceNumber, invoiceUrl, purposeCode, sourceOfFunds, recipientRelationship, 
//            quotePayload, quoteSignature, preferredWalletId, sourceOfFundsFile] = otherParams;

//     // Parse customerData (only this should be JSON)
//     let customerData;
//     try {
//       customerData = JSON.parse(customerDataStr);
//       if (typeof customerData !== "object" || customerData === null) {
//         throw new Error("customerData must be a JSON object");
//       }
//     } catch (error : any) {
//       return bot.sendMessage(chatId, `Invalid customerData JSON: ${error.message}`);
//     }

//     // Construct request body (no JSON parsing for other fields)
//     const requestBody = {
//       invoiceNumber,
//       invoiceUrl,
//       purposeCode,
//       sourceOfFunds,
//       recipientRelationship,
//       quotePayload, // Remains a string
//       quoteSignature, // Remains a string
//       preferredWalletId,
//       customerData, // Parsed JSON object
//       sourceOfFundsFile,
//       note: note || "",
//     };

//     // Send API request
//     const response = await axios.post(
//       "https://income-api.copperx.io/api/transfers/offramp",
//       requestBody,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${session.accessToken}`,
//         },
//       }
//     );

//     if (response.data && response.data.id) {
//       bot.sendMessage(chatId, `Offramp request successful! Transfer ID: ${response.data.id}`);
//     } else {
//       bot.sendMessage(chatId, `Unexpected response format from API.`);
//     }

//   } catch (error : any) {
//     console.error(`Error: ${error}`);
//     const errorMsg = error.response?.data?.message || error.message;
//     bot.sendMessage(chatId, `Error: ${errorMsg}`);
//   }
// });




// Send Bulk TXN's 





bot.onText(/\/sendbatch (.+)/, async (msg, match : any) => {
  const chatId = msg.chat.id;
  const session = userSessions[chatId];

  if (!session || !session.accessToken) {
    return bot.sendMessage(chatId, `No active session found. Please authenticate first.`);
  }

  try {
    const input = match[1].trim();
    const requestStrings = input.split("|").map((req : any) => req.trim());

    // Validate and parse each request
    const requests = requestStrings.map((reqStr : any, index : number) => {
      const params = reqStr.split(/\s+/).filter(Boolean);
      if (params.length !== 7) {
        throw new Error(`Invalid format for request #${index + 1}. Expected 7 fields: requestId walletAddress email payeeId amount purposeCode currency. Got ${params.length}: ${params.join(", ")}`);
      }

      const [requestId, walletAddress, email, payeeId, amount, purposeCode, currency] = params;

      // Basic validation
      if (isNaN(Number(amount)) || Number(amount) <= 0) {
        throw new Error(`Invalid amount "${amount}" in request #${index + 1}. Must be a positive number.`);
      }

      return {
        requestId,
        request: {
          walletAddress,
          email,
          payeeId,
          amount: amount.toString(), // Ensure string as per schema
          purposeCode,
          currency,
        },
      };
    });

    // Construct request body
    const requestBody = { requests };

    // Send API request
    const response = await axios.post(
      "https://income-api.copperx.io/api/transfers/send-batch",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    // Process response
    if (response.data && response.data.responses) {
      const reply = response.data.responses
        .map((res : any) => {
          if (res.error && res.error.message) {
            return `Request ${res.requestId}: Failed - ${res.error.error || "Unknown error"}`;
          }
          return `Request ${res.requestId}: Success - Transfer ID: ${res.response.id}`;
        })
        .join("\n");
      bot.sendMessage(chatId, `Batch payment results:\n${reply}`);
    } else {
      bot.sendMessage(chatId, `Unexpected response format from API.`);
    }

  } catch (error : any) {
    console.error(`Error: ${error}`);
    const errorMsg = error.response?.data?.message || error.message;
    console.log("Error message : ", errorMsg[0].children[0]);
    bot.sendMessage(chatId, `Error: ${errorMsg[0]}`);
  }
});




// ============================================================================
//  Notification API's
// ============================================================================


bot.onText(/\/auth_noti/,async (msg, match : any)=>{
  const session = userSessions[msg.chat.id];
  
  if(!session || !session.accessToken){
    return bot.sendMessage(msg.chat.id, "No session found!!");
  }

  try{
    const data = match[1].split(" ");
    const [socket_id, channel_name] = data;

    const response = await axios.post("https://income-api.copperx.io/api/notification/auth", 
      {
        socket_id : socket_id,
        channel_name : channel_name
      },
      {
      
        headers : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        }
      
    });

    
    const message = response.data;
    bot.sendMessage(msg.chat.id, `Auth : ${message.auth}, \n  user_data ${message.user_data}`);
  }
  catch(error){
    console.log(`Error : ${error}`);
    bot.sendMessage(msg.chat.id, `Error : ${error}`);
  }

});









