import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';
import PayeeModel  from "./DB";
import mongoose from 'mongoose';
import crypto from "crypto";
import QRCode from "qrcode";
dotenv.config();

const token = process.env.Tbot_token;
if (!token) {
  throw new Error('BOT TOKEN is missing in the environment variables.');
}

const mongoDb = process.env.MongoDB_Instance;
console.log(mongoDb);

const connect = async (mongoDb : any) => {
  try {
    await mongoose.connect(mongoDb,{
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
    });
    console.log("✅ Connected to MongoDB...");
  } catch (error : any) {
    console.error("❌ Error connecting to DB:", error.message);
  }
};
connect(mongoDb);

const URL = `https://api.telegram.org/bot${token}/setMyCommands`;

const commands = [
  { command: "start", description: "Start using bot" },
  { command: "help", description: "Display help" },
  { command : "kycs", description : "KYC"},
  { command : "balances", description : "view balance"},
  { command : "me", description : "verify otp"},
  { command : "wallets", description : "verify otp"},
  { command : "transfers", description : "verify otp"},
];


fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands })
})
.then(res => res.json())
.then(console.log)
.catch(console.error);







console.log(`Token: ${token}`);
console.log('Starting the bot...');


import Pusher from 'pusher-js';

const PUSHER_KEY = 'e089376087cac1a62785';
const PUSHER_CLUSTER = 'ap1';
const ORGANIZATION_ID = '6e1cc70a-815f-4331-8a3f-714a23e63a5a';

// Function to initialize Pusher client
const initPusherClient = (session: any) => {
  const pusherClient = new Pusher(PUSHER_KEY, {
    cluster: PUSHER_CLUSTER,
    authorizer: (channel) => ({
      authorize: async (socketId, callback) => {
        try {
          console.log(`🔍 Authenticating for socketId: ${socketId}, channel: ${channel.name}`);
    
          const response = await axios.post(
            'https://income-api.copperx.io/api/notifications/auth',
            { socket_id: socketId, channel_name: channel.name },
            { headers: { Authorization: `Bearer ${session.accessToken}` } }
          );
    
          console.log(`✅ Auth Response:`, response.data);
    
          if (response.data) {
            callback(null, response.data);
          } else {
            callback(new Error('Pusher authentication failed'), null);
          }
        } catch (error : any) {
          console.error('❌ Pusher authorization error:', error.response?.data || error.message);
          callback(error, null);
        }
      }
    })
    
  });

  return pusherClient;
};


const bot = new TelegramBot(token, {
  polling: {
    interval: 3000, // Increase to reduce API spam
    autoStart: false, 
    params: {
      timeout: 10, // Keep connection open for longer
    },
  },
});
// Define the structure of a single payee
interface PayeeT {
  name?: string;
  email: string;
  _id: string; // Use _id for MongoDB
}

// Define the structure of the batch payment state
interface BatchPaymentState {
  selectedPayees: PayeeT[];
  amounts: { [payeeId: string]: number };
  response: PayeeT[];
}
interface DepositState {
  selectedNetwork?: string;
  amount?: number;
}

// Update the UserSession interface to include batchPayment
interface UserSession {
  sid: string;
  email: string;
  accessToken?: string;
  isSubscribed?: boolean;
  otpRequested?: boolean;
  loggedIn?: boolean;
  walletAddress?: string;
  batchPayment?: BatchPaymentState; // Add batchPayment for the batch payment flow
  deposit?: DepositState; // Add deposit state
  pendingTransaction?: { payeeId: string; amount: number }; // Optional: for send_email action
}

const userSessions: Record<number, UserSession> = {};

bot.startPolling()
  .then(() => console.log("✅ Bot is running..."))
  .catch((error) => console.error("❌ Polling failed:", error));

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text : any = msg.text?.trim();

  if (!text) return;

  if (text.startsWith("/")) {
      if (!commands.includes(text)) {
          bot.sendMessage(chatId, "I'm not sure what you're trying to do. Use /help to see available commands or try 'send 5 USDC to user@example.com'.");
      }
  }
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome to the copperx-pay-out bot.. user /help to explore all options..');
});





bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const session = userSessions[chatId];
  const isLoggedIn = session && session.loggedIn;

  const loginOrLogoutButton = isLoggedIn
    ? [{ text: "🚪 Logout", callback_data: "logout" }]
    : [{ text: "🔑 Login", callback_data: "otp" }];

  const helpMessage = `
🚀 *CopperX Payout Bot - Command Guide*  

👋 Welcome! Use the commands below to manage your payouts with ease.  

📌 *General Commands:*  
🔹 /start – Start the bot  
🔹 /help – View available commands  

👤 *Profile & KYC:*  
🆔 /me – View your profile  
✅ /kyc – Check KYC status  

💰 *Wallet & Transactions:*  
💼 /balance – View wallet balance  
💸 /withdraw – Withdraw USDC  
📜 /transactions – Transaction history  
📤 /send – Send USDC via email  
📦 /sendbatch – Bulk transfer  
➕ /addpayee – Add a payee  
🗑 /removepayee – Remove payee  

📍 *Need help?* Join our community:  
🔗 [CopperX Telegram Group](https://t.me/copperxcommunity/2183)  

⚡ *Use these commands for a seamless experience!*
`;

  bot.sendMessage(chatId, helpMessage, {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [loginOrLogoutButton],
    },
  });
});


function sendMainMenu(chatId : any) {
  const menuMessage = `
🎉 *Welcome to CopperX Bot!*  

🚀 Manage your payouts, transactions, and wallets easily. Choose an option below:
  `;

  const menuButtons = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "👤 Me", callback_data: "profile" }, { text: "✅ KYC Status", callback_data: "kyc_status" }],
        [{ text: "💰 Wallets", callback_data: "wallets" }, { text: "📊 Check Balance", callback_data: "balance" }],
        [{ text: "📤 Send Money", callback_data: "send_money" }, { text: "➕ Deposit Crypto", callback_data: "deposit" }],
        [{ text: "⚙️ Set Default Wallet", callback_data: "set_default_wallet" }, { text: "➕ Add Payee", callback_data: "add_payee" }],
        [{ text: "📑 Bulk Payments", callback_data: "batch_payment" }, { text: "🔄 Transaction History", callback_data: "transactions" }],   [{ text: "⭕️ Remove Payee", callback_data: "Remove_payee" }],
        [{ text: "🚪 Logout", callback_data: "logout" }]
      ]
    }
  };

  bot.sendMessage(chatId, menuMessage, menuButtons);
}

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id!;
  const action = query.data;
  bot.answerCallbackQuery(query.id).catch((err) => console.log("Callback error:", err));

  if (action === "profile") {
    // ✅ Directly call the /me command logic
    bot.processUpdate({
      update_id: Date.now(),
      message: {
        message_id: Date.now(),
        chat: { id: chatId, type: "private" },
        text: "/me",
        date: Math.floor(Date.now() / 1000),
      },
    });
  }
  
  // ============================================================================
  else if (action === "kyc_status") {
    // ✅ Directly call the /me command logic
    bot.processUpdate({
      update_id: Date.now(),
      message: {
        message_id: Date.now(),
        chat: { id: chatId, type: "private" },
        text: "/kycs",
        date: Math.floor(Date.now() / 1000),
      },
    });
  }

  // ============================================================================

  else if (action === "wallets") {
    // ✅ Directly call the /me command logic
    bot.processUpdate({
      update_id: Date.now(),
      message: {
        message_id: Date.now(),
        chat: { id: chatId, type: "private" },
        text: "/wallets",
        date: Math.floor(Date.now() / 1000),
      },
    });
  }
  // ============================================================================
  else if (action === "balance") {
    // ✅ Directly call the /me command logic
    bot.processUpdate({
      update_id: Date.now(),
      message: {
        message_id: Date.now(),
        chat: { id: chatId, type: "private" },
        text: "/balances",
        date: Math.floor(Date.now() / 1000),
      },
    });
  }
// ============================================================================
  else if (action === "send_money") {
    // Send a menu with options for sending money
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Send to email", callback_data: "send_email" }],
          [{ text: "Send to wallet", callback_data: "send_wallet" }],
          [{ text: "Withdraw from bank", callback_data: "withdraw" }],
          [{ text: "Send to multiple users", callback_data: "send_bulk" }],
          [{ text: "Back", callback_data: "back" }],
        ],
      },
    };

    

    bot.sendMessage(chatId, "Choose a token to send:", options);
  }

  // ============================================================================
  else if (action === "send_email") {
    interface ResponseT {
      name?: string;
      email: string;
      id?: string; // Note: This might be _id in the database
    }
  
    try {
      const response: ResponseT[] = await PayeeModel.find({});
  
      if (response.length > 0) {
        // Step 1: Create buttons for each payee using _id
        const payeeButtons = response.map((payee) => [
          { text: `📧 ${payee.email}`, callback_data: `select_payee_${payee.id}` },
        ]);
  
        // Step 2: Show available payees
        bot.sendMessage(chatId, "*Available Payees:*", {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: payeeButtons,
          },
        });
  
        bot.on("callback_query", async (callbackQuery) => {
          const { message, data } = callbackQuery;
          const chatId = message?.chat.id;
          if (!chatId || !data) return;
  
          // Selecting Payee
          if (data.startsWith("select_payee_")) {
            const payeeId = data.replace("select_payee_", "");
  
            bot.sendMessage(chatId, "💰 *Enter the amount to send:*", {
              parse_mode: "Markdown",
              reply_markup: { force_reply: true },
            }).then((sentMessage) => {
              const messageId = sentMessage.message_id;
  
              bot.once("message", async function handleAmount(msg) {
                if (!msg.text || !msg.reply_to_message || msg.reply_to_message.message_id !== messageId) return;
  
                const amount = parseFloat(msg.text.trim());
                if (isNaN(amount) || amount <= 0) {
                  return bot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid number.");
                }
  
                // Step 4: Confirm transaction
                bot.sendMessage(chatId, `⚡ *Confirm sending ${amount} USDC?*`, {
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "✅ Confirm", callback_data: `confirm_txn_${payeeId}_${amount}` }],
                      [{ text: "❌ Cancel", callback_data: "cancel_txn" }],
                    ],
                  },
                });
              });
            });
          }
  
          // Confirm Transaction
          else if (data.startsWith("confirm_txn_")) {
            const [, payeeId, amount] = data.split("_");
  
            const session = userSessions[chatId];
  
            if (!session || !session.walletAddress) {
              return bot.sendMessage(chatId, "❌ Wallet not linked. Please link your wallet to proceed.", {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🔗 Link Wallet", callback_data: "link_wallet" }],
                  ],
                },
              });
            }
  
            try {
              const payee = await PayeeModel.findOne({ _id: payeeId });
              if (!payee) {
                return bot.sendMessage(chatId, "❌ Payee not found in the database.");
              }
              if (!payee.email) {
                return bot.sendMessage(chatId, "❌ Payee found, but no email is associated with it.");
              }
  
              const purposeCode = "TRANSFER";
              const currency = "USDC";
  
              bot.processUpdate({
                update_id: Date.now(),
                message: {
                  message_id: Date.now(),
                  chat: { id: chatId, type: "private" },
                  text: `/send ${session.walletAddress} ${payee.email} ${payeeId} ${amount} ${purposeCode} ${currency}`,
                  date: Math.floor(Date.now() / 1000),
                },
              });
            } catch (error) {
              console.error(`Error fetching payee: ${error}`);
              bot.sendMessage(chatId, "❌ Error occurred while retrieving payee details.");
            }
          }
  
          // Handling Wallet Linking
          else if (data === "link_wallet") {
            bot.sendMessage(chatId, "🔗 *Please enter your wallet address:*", {
              parse_mode: "Markdown",
              reply_markup: { force_reply: true },
            }).then((sentMessage) => {
              const messageId = sentMessage.message_id;
  
              bot.once("message", async function handleWallet(msg) {
                if (!msg.text || !msg.reply_to_message || msg.reply_to_message.message_id !== messageId) return;
  
                const walletAddress = msg.text.trim();
                if (!walletAddress) {
                  return bot.sendMessage(chatId, "❌ Invalid wallet address. Please try again.");
                }
  
                userSessions[chatId] = {
                  ...userSessions[chatId],
                  walletAddress: walletAddress,
                };
  
                bot.sendMessage(chatId, "✅ Wallet successfully linked! You can now proceed with transactions.");
              });
            });
          }
  
          // Cancel Transaction
          else if (data === "cancel_txn") {
            bot.sendMessage(chatId, "❌ Transaction cancelled.");
          }
        });
      } else {
        bot.sendMessage(chatId, "⚠️ No payees found.");
      }
    } catch (error) {
      console.error(`Error: ${error}`);
      bot.sendMessage(chatId, "❌ Error fetching the payees.");
    }
  }
  
  // The /send command handler remains unchanged
  
   
 // ============================================================================
  else if (action === "send_wallet") {
    // ✅ Simulate user sending "/send_wallet" command
    bot.processUpdate({
      update_id: Date.now(),
      message: {
        message_id: Date.now(),
        chat: { id: chatId, type: "private" },
        text: "/send",
        date: Math.floor(Date.now() / 1000),
      },
    });
  }
  // ============================================================================
  else if (action === "withdraw") {
    // ✅ Simulate user sending "/withdraw" command
    bot.processUpdate({
      update_id: Date.now(),
      message: {
        message_id: Date.now(),
        chat: { id: chatId, type: "private" },
        text: "/withdraw",
        date: Math.floor(Date.now() / 1000),
      },
    });
  }
  // ============================================================================
  else if (action === "deposit") {
    const session = userSessions[chatId];
    if (!session || !session.accessToken) {
      return bot.sendMessage(chatId, "❌ No active session. Verify OTP first.");
    }
  
    try {

      if (!session.isSubscribed) {
        session.isSubscribed = true;
        const pusherClient = initPusherClient(session);
        const channel = pusherClient.subscribe(`private-org-${ORGANIZATION_ID}`);
  
        channel.bind('pusher:subscription_succeeded', () => {
          bot.sendMessage(chatId, '✅ Subscribed to deposit notifications.');
        });
  
        channel.bind('pusher:subscription_error', (error  : any) => {
          console.error('Subscription error:', error);
          bot.sendMessage(chatId, `❌ Subscription error: ${error.message}`);
        });
  
        channel.bind('deposit', (data : any) => {
          bot.sendMessage(
            chatId,
            `💰 *New Deposit Received*\n\n${data.amount} USDC deposited on Solana.`
          );
        });
      } else {
        console.log("Already subscribed to notifications");
      }
      // Define the list of networks
      const networks = ["Starknet", "Base", "Arbitrum", "Polygon", "<= Go Back"];
  
      // Initialize deposit state in the session
      userSessions[chatId] = {
        ...userSessions[chatId],
        deposit: {
          selectedNetwork: undefined,
          amount: undefined,
        },
      };
  
      // Function to update network selection message
      const updateNetworkSelectionMessage = async () => {
        const { selectedNetwork } = userSessions[chatId].deposit!;
        const networkButtons = networks.map((network) => {
          const isSelected = selectedNetwork === network;
          const isGoBack = network === "<= Go Back";
          return [
            {
              text: isGoBack ? network : `${isSelected ? "✅ " : ""}🌐 ${network}`,
              callback_data: isGoBack ? "go_back" : `select_network_${network}`,
            },
          ];
        });
  
        const sentMessage = await bot.sendMessage(chatId, "*Select a network for your deposit:*", {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: networkButtons,
          },
        });
  
        // Handle callback queries for this specific message
        bot.once("callback_query", async (callbackQuery) => {
          const { message, data } = callbackQuery;
          const currentChatId = message?.chat.id;
          if (!currentChatId || !data || currentChatId !== chatId) return;
  
          const session = userSessions[chatId];
          if (!session || !session.deposit) return;
  
          // Log the callback data for debugging
          console.log(`Callback query data: ${data}`);
  
          // Handle network selection
          if (data.startsWith("select_network_")) {
            const network = data.replace("select_network_", "");
            console.log(`Network selected: ${network}`);
  
            session.deposit.selectedNetwork = network;
            userSessions[chatId] = session;
  
            // Proceed to deposit instructions immediately after selection
            try {
              await bot.deleteMessage(chatId, message.message_id);
            } catch (error) {
              console.error(`Error deleting message: ${error}`);
            }
  
            // Step 2: Display deposit instructions
            await bot.sendMessage(chatId, "Fetching your wallet address...");
  
            // Hardcoded wallet address for testing (replace with actual API call)
            const walletAddress = "0x8D6B1D69EF76F73CA91142E050189B9DEc1b2F84";
  
            const depositInstructions = `
  💎 *Deposit Instructions*
  
  To deposit funds to your wallet:
  
  1. Send your funds to this address:
  \`${walletAddress}\`
  
  2. Make sure to select the correct network:
  *${network.toUpperCase()}*
  
  ⚠️ *Important:*
  - Only send supported tokens
  - Double-check the network before sending
  - Minimum deposit amount may apply
  
  Would you like a QR code for this address?
            `;
  
            const sentInstructions = await bot.sendMessage(chatId, depositInstructions, {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Generate QR Code", callback_data: "generate_qr_code" },
                    { text: "❌ No Thanks", callback_data: "no_thanks" },
                  ],
                  [
                    { text: "« Back to Menu", callback_data: "back_to_menu" },
                  ],
                ],
              },
            });
  
            // Handle callback queries for the deposit instructions
            bot.once("callback_query", async (callbackQuery) => {
              const { message, data } = callbackQuery;
              const currentChatId = message?.chat.id;
              if (!currentChatId || !data || currentChatId !== chatId) return;
  
              // Log the callback data for debugging
              console.log(`Deposit instructions callback query data: ${data}`);
  
              // Generate QR Code
              if (data === "generate_qr_code") {
                try {
                  await bot.deleteMessage(chatId, message.message_id);
                } catch (error) {
                  console.error(`Error deleting message: ${error}`);
                }
  
                // Generate QR code for the wallet address
                const qrCodeImage = await QRCode.toBuffer(walletAddress);
  
                // Send the QR code image
                await bot.sendPhoto(chatId, qrCodeImage, {
                  caption: `QR code for wallet address: \`${walletAddress}\`\nNetwork: *${network.toUpperCase()}*`,
                  parse_mode: "Markdown",
                });
  
                delete userSessions[chatId].deposit;
              }
  
              // No Thanks (end the process)
              else if (data === "no_thanks") {
                try {
                  await bot.deleteMessage(chatId, message.message_id);
                } catch (error) {
                  console.error(`Error deleting message: ${error}`);
                }
                await bot.sendMessage(chatId, "Deposit instructions dismissed.");
                delete userSessions[chatId].deposit;
              }
  
              // Back to Menu (cancel the process)
              else if (data === "back_to_menu") {
                try {
                  await bot.deleteMessage(chatId, message.message_id);
                } catch (error) {
                  console.error(`Error deleting message: ${error}`);
                }
                await bot.sendMessage(chatId, "Returning to menu...");
                delete userSessions[chatId].deposit;
              }
            });
          }
  
          // Go back (cancel the deposit process)
          else if (data === "go_back") {
            try {
              await bot.deleteMessage(chatId, message.message_id);
            } catch (error) {
              console.error(`Error deleting message: ${error}`);
            }
            await bot.sendMessage(chatId, "❌ Deposit process cancelled.");
            delete userSessions[chatId].deposit;
          } else {
            console.log(`Unexpected callback query data: ${data}`);
          }
        });
      };
  
      // Step 1: Show available networks as buttons
      await updateNetworkSelectionMessage();
    } catch (error) {
      console.error(`Error in deposit process: ${error}`);
      bot.sendMessage(chatId, `❌ Error during deposit process: ${error}`);
    }
  }
  // ============================================================================
  else if (action === "set_default_wallet") {
    bot.sendMessage(chatId, "💳 Please enter the wallet ID you want to set as default. Example: `wallet_123`", {
        parse_mode: "Markdown",
        reply_markup: {
            force_reply: true, // This forces a reply input box
        },
    }).then(sentMessage => {
        // Listen for user's reply to this specific message
        bot.onReplyToMessage(chatId, sentMessage.message_id, async (msg: any) => {
            const walletId = msg.text.trim(); // No regex validation

            // Simulate user sending "/setdefault wallet_123" command
            bot.processUpdate({
                update_id: Date.now(),
                message: {
                    message_id: Date.now(),
                    chat: { id: chatId, type: "private" },
                    text: `/setdefault ${walletId}`,
                    date: Math.floor(Date.now() / 1000),
                },
            });
        });
    });
}
// ============================================================================
else if (action === "transactions") {
  // ✅ Directly call the /me command logic
  bot.processUpdate({
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      chat: { id: chatId, type: "private" },
      text: "/transfers",
      date: Math.floor(Date.now() / 1000),
    },
  });
}
// ============================================================================
else if (action == "add_payee") {
 
  interface ResponseT {
    name?: string;
    email: string;
    id: string;
  }

  const session = userSessions[chatId];
  
  if (!session || !session.accessToken) {
    return bot.sendMessage(chatId, '❌ No active session. Verify OTP first.');
  }

  // Step 1: Ask for the payee's email with force_reply
  bot.sendMessage(chatId, "📩 *Please enter the payee's Email:*", {
    parse_mode: "Markdown",
    reply_markup: {
      force_reply: true, // Forces the user to reply
    },
  }).then(async (sentMessage) => {
    const messageId = sentMessage.message_id;

    try {
      const response: ResponseT[] = await PayeeModel.find({});

      if (response.length > 0) {
        // Create buttons for each payee
        const payeeButtons = response.map((payee) => [
          { text: `📧 ${payee.email}`, callback_data: `payee_${payee.id}` },
        ]);


        // Step 2: Show payees in a button format
        bot.sendMessage(chatId, "*Available Payees:*", {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: payeeButtons,
          },
        });
      } else {
        bot.sendMessage(chatId, "⚠️ No payees found.");
      }
    } catch (error) {
      console.error(`Error: ${error}`);
      bot.sendMessage(chatId, "❌ Error fetching the payees.");
    }

    // Step 3: Add a better cancel button with an explanation
    bot.sendMessage(chatId, "** Cancel and Go Back! **", {  // Zero-width space (might not work)
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🚫 Cancel Action", callback_data: "cancel_add_payee" }]],
      },
    });
    

    // Step 4: Handle user's email reply (Avoid duplicate event listeners)
    bot.once("message", async (msg: any) => {
      if (msg.reply_to_message?.message_id === messageId) {
        const email = msg.text.trim();
        const id = crypto.randomUUID(); // Generates a unique ID

        try {
          const newPayee = await PayeeModel.create({ email, id });
          console.log("Response Data:", newPayee);
          bot.sendMessage(chatId, `✅ *Payee added successfully!*\n👤 *Email:* ${email}\n🆔 *ID:* ${id}`, {
            parse_mode: "Markdown",
          });
        } catch (error: any) {
          console.error(`Error: ${error.message}`);
          bot.sendMessage(chatId, "❌ Error adding the payee. Please try again.");
        }
      }
    });
  });
}
// ============================================================================
else if (action == "Remove_payee") {
 
  interface ResponseT {
    name?: string;
    email: string;
    id: string;
  }
  const session = userSessions[chatId];
  if (!session || !session.accessToken) {
    return bot.sendMessage(chatId, '❌ No active session. Verify OTP first.');
  }

  try {
    const response: ResponseT[] = await PayeeModel.find({});
    
    if (response.length > 0) {
      // Create inline buttons for each payee
      const payeeButtons = response.map((payee) => [
        { text: `📧 ${payee.email}`, callback_data: `remove_payee_${payee.id}` },
      ]);

      // Step 1: Show available payees as buttons
      bot.sendMessage(chatId, "*Select a payee to remove:*", {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: payeeButtons,
        },
      });

      // Step 2: Add a cancel button
      bot.sendMessage(chatId, "🚫 *Cancel and Go Back!*", {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_remove_payee" }]],
        },
      });

      // Step 3: Handle payee removal when a user clicks the button
bot.on("callback_query", async (callbackQuery) => {
  const { message, data } = callbackQuery;
  const chatId = message?.chat.id;

  if(!data || !chatId) return;

  if (data.startsWith("remove_payee_")) {
    const payeeId = data.replace("remove_payee_", ""); // Extract payee ID

    try {
      // Remove the payee from the database
      const deletedPayee = await PayeeModel.findOneAndDelete({ id: payeeId });

      if (deletedPayee) {
        bot.sendMessage(chatId, `✅ *Payee removed successfully!*\n📧 *Email:* ${deletedPayee.email}`, {
          parse_mode: "Markdown",
        });
      } else {
        bot.sendMessage(chatId, "⚠️ Payee not found.");
      }
    } catch (error) {
      console.error(`Error: ${error}`);
      bot.sendMessage(chatId, "❌ Error removing the payee.");
    }
  } else if (data === "cancel_remove_payee") {
    bot.sendMessage(chatId, "❌ *Action canceled!*", { parse_mode: "Markdown" });
  }
});
    } else {
      bot.sendMessage(chatId, "⚠️ No payees found.");
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    bot.sendMessage(chatId, "❌ Error fetching the payees.");
  }
}



else if (action === "batch_payment") {
  const session = userSessions[chatId];
  if (!session || !session.accessToken) {
    return bot.sendMessage(chatId, "❌ No active session. Verify OTP first.");
  }

  try {
    const response: PayeeT[] = await PayeeModel.find({});

    if (response.length > 0) {
      // Initialize batch payment state in the session
      userSessions[chatId] = {
        ...userSessions[chatId],
        batchPayment: {
          selectedPayees: [],
          amounts: {},
          response,
        },
      };

      // Function to update payee selection message
      const updatePayeeSelectionMessage = async () => {
        const { selectedPayees } = userSessions[chatId].batchPayment!;
        const payeeButtons = response.map((payee) => {
          const isSelected = selectedPayees.some((p) => p._id.toString() === payee._id.toString());
          return [
            {
              text: `${isSelected ? "✅ " : ""}📧 ${payee.email}`,
              callback_data: `toggle_payee_${payee._id}`,
            },
          ];
        });

        // Add Done and Cancel buttons
        payeeButtons.push([
          { text: "✅ Done Selecting", callback_data: "done_selecting_payees" },
          { text: "❌ Cancel", callback_data: "cancel_batch_payment" },
        ]);

        const sentMessage = await bot.sendMessage(chatId, "*Select payees for batch payment:*", {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: payeeButtons,
          },
        });

        // Handle callback queries for this specific message
        bot.once("callback_query", async (callbackQuery) => {
          const { message, data } = callbackQuery;
          const currentChatId = message?.chat.id;
          if (!currentChatId || !data || currentChatId !== chatId) return;

          const session = userSessions[chatId];
          if (!session || !session.batchPayment) return;

          // Toggle payee selection
          if (data.startsWith("toggle_payee_")) {
            const payeeId = data.replace("toggle_payee_", "");
            const payee = response.find((p) => p._id.toString() === payeeId);
            if (!payee) return;

            let { selectedPayees } = session.batchPayment;
            const isSelected = selectedPayees.some((p) => p._id.toString() === payeeId);

            if (isSelected) {
              // Deselect payee
              selectedPayees = selectedPayees.filter((p) => p._id.toString() !== payeeId);
              delete session.batchPayment.amounts[payeeId];
            } else {
              // Select payee
              selectedPayees.push(payee);
            }

            session.batchPayment.selectedPayees = selectedPayees;
            userSessions[chatId] = session;

            // Update the message with the new selection
            try {
              await bot.deleteMessage(chatId, message.message_id);
            } catch (error) {
              console.error(`Error deleting message: ${error}`);
            }

            await updatePayeeSelectionMessage();
          }

          // Done selecting payees
          else if (data === "done_selecting_payees") {
            const { selectedPayees } = session.batchPayment;

            if (selectedPayees.length === 0) {
              try {
                await bot.deleteMessage(chatId, message.message_id);
              } catch (error) {
                console.error(`Error deleting message: ${error}`);
              }
              await bot.sendMessage(chatId, "❌ No payees selected for batch payment.");
              delete userSessions[chatId].batchPayment;
              return;
            }

            // Step 2: Prompt for amounts
            try {
              await bot.deleteMessage(chatId, message.message_id);
            } catch (error) {
              console.error(`Error deleting message: ${error}`);
            }

            const promptForAmount = async (index: number) => {
              if (index >= selectedPayees.length) {
                // Step 3: All amounts collected, trigger /sendbatch
                if (!session.walletAddress) {
                  const walletMessage = await bot.sendMessage(chatId, "❌ Wallet not linked. Please link your wallet to proceed.", {
                    reply_markup: {
                      inline_keyboard: [
                        [{ text: "🔗 Link Wallet", callback_data: "link_wallet" }],
                      ],
                    },
                  });

                  bot.once("callback_query", async (walletCallback) => {
                    const { message: walletMsg, data: walletData } = walletCallback;
                    const walletChatId = walletMsg?.chat.id;
                    if (!walletChatId || !walletData || walletChatId !== chatId || walletData !== "link_wallet") return;

                    const walletPrompt = await bot.sendMessage(chatId, "🔗 *Please enter your wallet address:*", {
                      parse_mode: "Markdown",
                      reply_markup: { force_reply: true },
                    });

                    bot.once("message", async (msg) => {
                      if (!msg.text || !msg.reply_to_message || msg.reply_to_message.message_id !== walletPrompt.message_id) return;

                      const walletAddress = msg.text.trim();
                      if (!walletAddress) {
                        await bot.sendMessage(chatId, "❌ Invalid wallet address. Please try again.");
                        return;
                      }

                      userSessions[chatId] = {
                        ...userSessions[chatId],
                        walletAddress: walletAddress,
                      };

                      await bot.sendMessage(chatId, "✅ Wallet successfully linked! You can now proceed with transactions.");

                      // Resume the batch payment process
                      const purposeCode = "TRANSFER";
                      const currency = "USDC";
                      const requests = selectedPayees.map((payee: PayeeT, idx: number) => {
                        const requestId = `req${idx + 1}`;
                        const amount = session.batchPayment!.amounts[payee._id.toString()];
                        return `${requestId} ${walletAddress} ${payee.email} ${payee._id} ${amount} ${purposeCode} ${currency}`;
                      }).join(" | ");

                      // Log the /sendbatch command for debugging
                      console.log(`Triggering /sendbatch command: /sendbatch ${requests}`);

                      try {
                        await bot.processUpdate({
                          update_id: Date.now(),
                          message: {
                            message_id: Date.now(),
                            chat: { id: chatId, type: "private" },
                            text: `/sendbatch ${requests}`,
                            date: Math.floor(Date.now() / 1000),
                          },
                        });
                      } catch (error : any) {
                        console.error(`Error triggering /sendbatch: ${error.message}`, error);
                        await bot.sendMessage(chatId, `❌ Failed to process batch payment: ${error.message}`);
                      }

                      delete userSessions[chatId].batchPayment;
                    });
                  });

                  return;
                }

                // Construct the /sendbatch command
                const purposeCode = "TRANSFER";
                const currency = "USDC";
                const requests = selectedPayees.map((payee: PayeeT, idx: number) => {
                  const requestId = `req${idx + 1}`;
                  const amount = session.batchPayment!.amounts[payee._id.toString()];
                  return `${requestId} ${session.walletAddress} ${payee.email} ${payee._id} ${amount} ${purposeCode} ${currency}`;
                }).join(" | ");

                // Log the /sendbatch command for debugging
                console.log(`Triggering /sendbatch command: /sendbatch ${requests}`);

                try {
                  await bot.processUpdate({
                    update_id: Date.now(),
                    message: {
                      message_id: Date.now(),
                      chat: { id: chatId, type: "private" },
                      text: `/sendbatch ${requests}`,
                      date: Math.floor(Date.now() / 1000),
                    },
                  });
                } catch (error : any) {
                  console.error(`Error triggering /sendbatch: ${error.message}`, error);
                  await bot.sendMessage(chatId, `❌ Failed to process batch payment: ${error.message}`);
                }

                // Clean up the session
                delete userSessions[chatId].batchPayment;
                return;
              }

              const amountPrompt = await bot.sendMessage(chatId, `Please enter the amount for *${selectedPayees[index].email}*:`, {
                parse_mode: "Markdown",
                reply_markup: { force_reply: true },
              });

              bot.once("message", async (msg) => {
                if (!msg.text || !msg.reply_to_message || msg.reply_to_message.message_id !== amountPrompt.message_id) return;

                const amount = parseFloat(msg.text.trim());
                if (isNaN(amount) || amount <= 0) {
                  await bot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid positive number.");
                  await promptForAmount(index); // Retry for the same payee
                  return;
                }

                // Store the amount for the current payee
                session.batchPayment!.amounts[selectedPayees[index]._id.toString()] = amount;
                userSessions[chatId] = session;

                // Prompt for the next payee
                await promptForAmount(index + 1);
              });
            };

            await bot.sendMessage(chatId, `*Enter amounts for the selected payees:*\n${selectedPayees.map((p) => `- ${p.email}`).join("\n")}\n`, {
              parse_mode: "Markdown",
            });
            await promptForAmount(0);
          }

          // Cancel batch payment
          else if (data === "cancel_batch_payment") {
            try {
              await bot.deleteMessage(chatId, message.message_id);
            } catch (error) {
              console.error(`Error deleting message: ${error}`);
            }
            await bot.sendMessage(chatId, "❌ Batch payment cancelled.");
            delete userSessions[chatId].batchPayment;
          }
        });
      };

      // Step 1: Show available payees as buttons
      await updatePayeeSelectionMessage();
    } else {
      bot.sendMessage(chatId, "⚠️ No payees found.");
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    bot.sendMessage(chatId, `❌ Error fetching the payees: ${error}`);
  }
}
// ============================================================================

else if (action === "deposit") {
  const session = userSessions[chatId];
  if (!session || !session.accessToken) {
    return bot.sendMessage(chatId, "❌ No active session. Verify OTP first.");
  }

  try {
    if (!session.isSubscribed) {
      session.isSubscribed = true;
      const pusherClient = initPusherClient(session);
      const channel = pusherClient.subscribe(`private-org-${ORGANIZATION_ID}`);

      channel.bind('pusher:subscription_succeeded', () => {
        bot.sendMessage(chatId, '✅ Subscribed to deposit notifications.');
      });

      channel.bind('pusher:subscription_error', (error  : any) => {
        console.error('Subscription error:', error);
        bot.sendMessage(chatId, `❌ Subscription error: ${error.message}`);
      });

      channel.bind('deposit', (data : any) => {
        bot.sendMessage(
          chatId,
          `💰 *New Deposit Received*\n\n${data.amount} USDC deposited on Solana.`
        );
      });
    } else {
      console.log("Already subscribed to notifications");
    }
    // Define the list of networks
    const networks = ["Starknet", "Base", "Arbitrum", "Polygon", "<= Go Back"];

    // Initialize deposit state in the session
    userSessions[chatId] = {
      ...userSessions[chatId],
      deposit: {
        selectedNetwork: undefined,
        amount: undefined,
      },
    };

    // Function to update network selection message
    const updateNetworkSelectionMessage = async () => {
      const { selectedNetwork } = userSessions[chatId].deposit!;
      const networkButtons = networks.map((network) => {
        const isSelected = selectedNetwork === network;
        const isGoBack = network === "<= Go Back";
        return [
          {
            text: isGoBack ? network : `${isSelected ? "✅ " : ""}🌐 ${network}`,
            callback_data: isGoBack ? "go_back" : `select_network_${network}`,
          },
        ];
      });

      const sentMessage = await bot.sendMessage(chatId, "*Select a network for your deposit:*", {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: networkButtons,
        },
      });

      // Handle callback queries for this specific message
      bot.once("callback_query", async (callbackQuery) => {
        const { message, data } = callbackQuery;
        const currentChatId = message?.chat.id;
        if (!currentChatId || !data || currentChatId !== chatId) return;

        const session = userSessions[chatId];
        if (!session || !session.deposit) return;

        // Handle network selection
        if (data.startsWith("select_network_")) {
          const network = data.replace("select_network_", "");
          session.deposit.selectedNetwork = network;
          userSessions[chatId] = session;

          // Update the message with the new selection
          try {
            await bot.deleteMessage(chatId, message.message_id);
          } catch (error) {
            console.error(`Error deleting message: ${error}`);
          }

          await updateNetworkSelectionMessage();
        }

        // Go back (cancel the deposit process)
        else if (data === "go_back") {
          try {
            await bot.deleteMessage(chatId, message.message_id);
          } catch (error) {
            console.error(`Error deleting message: ${error}`);
          }
          await bot.sendMessage(chatId, "❌ Deposit process cancelled.");
          delete userSessions[chatId].deposit;
        }

        // Done selecting network (proceed to amount input)
        else if (data === "select_network_" + session.deposit.selectedNetwork) {
          const { selectedNetwork } = session.deposit;

          if (!selectedNetwork) {
            try {
              await bot.deleteMessage(chatId, message.message_id);
            } catch (error) {
              console.error(`Error deleting message: ${error}`);
            }
            await bot.sendMessage(chatId, "❌ No network selected for deposit.");
            delete userSessions[chatId].deposit;
            return;
          }

          // Step 2: Prompt for amount
          try {
            await bot.deleteMessage(chatId, message.message_id);
          } catch (error) {
            console.error(`Error deleting message: ${error}`);
          }

          const amountPrompt = await bot.sendMessage(chatId, `Please enter the deposit amount for *${selectedNetwork}*:`, {
            parse_mode: "Markdown",
            reply_markup: { force_reply: true },
          });

          bot.once("message", async (msg) => {
            if (!msg.text || !msg.reply_to_message || msg.reply_to_message.message_id !== amountPrompt.message_id) return;

            const amount = parseFloat(msg.text.trim());
            if (isNaN(amount) || amount <= 0) {
              await bot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid positive number.");
              // Retry for the amount
              const retryPrompt = await bot.sendMessage(chatId, `Please enter the deposit amount for *${selectedNetwork}*:`, {
                parse_mode: "Markdown",
                reply_markup: { force_reply: true },
              });

              bot.once("message", async (retryMsg) => {
                if (!retryMsg.text || !retryMsg.reply_to_message || retryMsg.reply_to_message.message_id !== retryPrompt.message_id) return;

                const retryAmount = parseFloat(retryMsg.text.trim());
                if (isNaN(retryAmount) || retryAmount <= 0) {
                  await bot.sendMessage(chatId, "❌ Invalid amount. Deposit process cancelled.");
                  delete userSessions[chatId].deposit;
                  return;
                }

                session.deposit!.amount = retryAmount;
                userSessions[chatId] = session;

                // Proceed to wallet linking and deposit
                await proceedWithDeposit();
              });
              return;
            }

            // Store the amount
            session.deposit!.amount = amount;
            userSessions[chatId] = session;

            // Proceed to wallet linking and deposit
            await proceedWithDeposit();
          });

          // Function to handle wallet linking and deposit
          const proceedWithDeposit = async () => {
            if (!session.walletAddress) {
              const walletMessage = await bot.sendMessage(chatId, "❌ Wallet not linked. Please link your wallet to proceed.", {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🔗 Link Wallet", callback_data: "link_wallet" }],
                  ],
                },
              });

              bot.once("callback_query", async (walletCallback) => {
                const { message: walletMsg, data: walletData } = walletCallback;
                const walletChatId = walletMsg?.chat.id;
                if (!walletChatId || !walletData || walletChatId !== chatId || walletData !== "link_wallet") return;

                const walletPrompt = await bot.sendMessage(chatId, "🔗 *Please enter your wallet address:*", {
                  parse_mode: "Markdown",
                  reply_markup: { force_reply: true },
                });

                bot.once("message", async (msg) => {
                  if (!msg.text || !msg.reply_to_message || msg.reply_to_message.message_id !== walletPrompt.message_id) return;

                  const walletAddress = msg.text.trim();
                  if (!walletAddress) {
                    await bot.sendMessage(chatId, "❌ Invalid wallet address. Please try again.");
                    return;
                  }

                  userSessions[chatId] = {
                    ...userSessions[chatId],
                    walletAddress: walletAddress,
                  };

                  await bot.sendMessage(chatId, "✅ Wallet successfully linked! You can now proceed with your deposit.");

                  // Resume the deposit process
                  const { selectedNetwork, amount } = session.deposit!;
                  const depositCommand = `/deposit ${walletAddress} ${selectedNetwork} ${amount}`;

                  // Log the /deposit command for debugging
                  console.log(`Triggering /deposit command: ${depositCommand}`);

                  try {
                    await bot.processUpdate({
                      update_id: Date.now(),
                      message: {
                        message_id: Date.now(),
                        chat: { id: chatId, type: "private" },
                        text: depositCommand,
                        date: Math.floor(Date.now() / 1000),
                      },
                    });
                  } catch (error : any) {
                    console.error(`Error triggering /deposit: ${error.message}`, error);
                    await bot.sendMessage(chatId, `❌ Failed to process deposit: ${error.message}`);
                  }

                  delete userSessions[chatId].deposit;
                });
              });

              return;
            }

            // Step 3: Trigger /deposit command
            const { selectedNetwork, amount } = session.deposit!;
            const depositCommand = `/deposit ${session.walletAddress} ${selectedNetwork} ${amount}`;

            // Log the /deposit command for debugging
            console.log(`Triggering /deposit command: ${depositCommand}`);

            try {
              await bot.processUpdate({
                update_id: Date.now(),
                message: {
                  message_id: Date.now(),
                  chat: { id: chatId, type: "private" },
                  text: depositCommand,
                  date: Math.floor(Date.now() / 1000),
                },
              });
            } catch (error : any) {
              console.error(`Error triggering /deposit: ${error.message}`, error);
              await bot.sendMessage(chatId, `❌ Failed to process deposit: ${error.message}`);
            }

            // Clean up the session
            delete userSessions[chatId].deposit;
          };
        }
      });
    };

    // Step 1: Show available networks as buttons
    await updateNetworkSelectionMessage();
  } catch (error) {
    console.error(`Error in deposit process: ${error}`);
    bot.sendMessage(chatId, `❌ Error during deposit process: ${error}`);
  }
}



  else if (action === "logout") {
    delete userSessions[chatId];
    bot.sendMessage(chatId, "✅ You have been logged out.");
  }
});


// Step 5: Handle button clicks for canceling or selecting a payee
bot.on("callback_query", (callbackQuery :any) => {
  const chatId = callbackQuery.message.chat.id;

  if (callbackQuery.data === "cancel_add_payee") {
    bot.sendMessage(chatId, "✅ *Action canceled.*", { parse_mode: "Markdown" });
    bot.answerCallbackQuery(callbackQuery.id); // Acknowledge the callback
  } else if (callbackQuery.data.startsWith("payee_")) {
    const payeeId = callbackQuery.data.split("_")[1];
    bot.sendMessage(chatId, `ℹ️ *You selected Payee ID:* ${payeeId}`, { parse_mode: "Markdown" });
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id!;
  const action = query.data;
  bot.answerCallbackQuery(query.id).catch((err) => console.log("Callback error:", err));

  if (action === "otp") {
    try {
      const sentMessage = await bot.sendMessage(chatId, "🔑 Please enter your email:", {
        reply_markup: { force_reply: true },
      });

      bot.once("message", async function emailHandler(replyMsg) {
        if (!replyMsg.reply_to_message || replyMsg.reply_to_message.message_id !== sentMessage.message_id) return;
        const email: string = replyMsg.text?.trim() || "";

        if (!email.includes("@")) {
          return bot.sendMessage(chatId, "❌ Invalid email format. Please enter a valid email.");
        }

        try {
          const { data } = await axios.post(
            "https://income-api.copperx.io/api/auth/email-otp/request",
            { email },
            { headers: { "Content-Type": "application/json" } }
          );

          userSessions[chatId] = { sid: data.sid, email, otpRequested: true };

          console.log(`🔍 [OTP Sent] Email: ${email}, SID: ${data.sid}`);

          const otpMessage = await bot.sendMessage(chatId, "📩 OTP sent to your email! Please reply with the OTP:", {
            reply_markup: { force_reply: true },
          });

          bot.once("message", async function otpHandler(otpReply) {
            if (!otpReply.reply_to_message || otpReply.reply_to_message.message_id !== otpMessage.message_id) return;
            const otp = otpReply.text?.trim() || "";

            if (!/^\d{6}$/.test(otp)) {
              bot.sendMessage(chatId, "⚠️ Invalid OTP format. Please enter a **6-digit numeric OTP**.");
              return bot.once("message", otpHandler); // Reattach listener
            }

            const session = userSessions[chatId];
            if (!session || !session.sid) {
              return bot.sendMessage(chatId, "❌ Session expired. Please request a new OTP.");
            }

            console.log(`🔍 [OTP Verifying] Email: ${session.email}, OTP: ${otp}, SID: ${session.sid}`);

            try {
              const { data } = await axios.post(
                "https://income-api.copperx.io/api/auth/email-otp/authenticate",
                { email: session.email, otp, sid: session.sid },
                { headers: { "Content-Type": "application/json" } }
              );

              console.log("✅ [API Response]:", data);

              if (data.accessToken) {
                userSessions[chatId].loggedIn = true;
                userSessions[chatId].accessToken = data.accessToken; // ✅ Store accessToken

                console.log(`✅ [Login Success] Email: ${session.email}`);

                // Send structured menu instead of just a success message
                sendMainMenu(chatId);

                bot.sendMessage(chatId, "✅ OTP verified successfully! You are now logged in.");
              } else {
                bot.sendMessage(chatId, "❌ OTP verification failed. Please check your OTP and try again.");
                return bot.once("message", otpHandler); // Reattach listener
              }
            } catch (error: any) {
              console.error("❌ [OTP Error]:", error.response?.data || error.message);
              bot.sendMessage(chatId, `⚠️ Error verifying OTP: ${error.response?.data?.message || "Unknown error. Try again."}`);
              return bot.once("message", otpHandler); // Reattach listener
            }
          });
        } catch (error: any) {
          console.error("❌ [OTP Request Error]:", error.response?.data || error.message);
          bot.sendMessage(chatId, "⚠️ Error sending OTP. Please try again later.");
        }
      });
    } catch (err) {
      console.error("Error in OTP request:", err);
      bot.sendMessage(chatId, "⚠️ Unable to process OTP request.");
    }
  }


  
  
  
  else if (action === "logout") {
    delete userSessions[chatId];
    bot.sendMessage(chatId, "✅ You have been logged out.");
  }
});


// ============================================================================
// bot.on("message", async (msg) => {
//   const chatId = msg.chat.id;
//   const text = msg.text?.trim();

//   // ✅ Ignore messages without text
//   if (!text) return;

//   // ✅ Ignore bot messages (prevents commands sent by bot from triggering)
//   if (msg.from?.is_bot) return;

//   // ✅ Allow valid commands to proceed
//   const validCommands = [
//     "/start",
//     "/help",
//     "/kycs",
//     "/balances",
//     "/notification",
//     "/withdraw",
//     "/transactions",
//     "/otp",
//     "/verify",
//     "/me", // Added so that /me is recognized
//   ];

//   // ✅ If it's a valid command, don't send an error
//   if (validCommands.includes(text)) return;

//   // ✅ If it's not a valid command, reply with the error
//   bot.sendMessage(
//     chatId,
//     `I don't know what this is but check /help, might help in what you trying to do..`,
//     { parse_mode: "Markdown" }
//   );
// });




// ============================================================================
// Authentication APIs
// ============================================================================



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

// ============================================================================

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



bot.onText(/\/link_wallet (.+)/, (msg, match) => {
  
  const chatId = msg.chat.id;

  if(!match) return;
  const walletAddress = match[1].trim();

  const updatedAddress = walletAddress.replace(/-/g, "");

  if (!walletAddress) {
      return bot.sendMessage(chatId, "❌ Please provide a valid wallet address.");
  }

  // Store wallet address in session
  userSessions[chatId] = {
      ...userSessions[chatId], // Keep other session data intact
      walletAddress: updatedAddress, 
  };

  bot.sendMessage(chatId, "✅ Wallet successfully linked!");
});


// ============================================================================

bot.onText(/\/me/, async (msg) => {
  const session = userSessions[msg.chat.id];

  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  console.log(session.accessToken);
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
// Wallet Management
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

// ============================================================================

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
// ============================================================================
bot.onText(/\/setdefault (.+)/, async (msg, match) => {
  const session = userSessions[msg.chat.id];

  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, '❌ No active session. Verify OTP first.');
  }

  if (!match || !match[1]) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please provide a wallet ID. Example: /setdefault wallet_123');
  }

  const walletId = match[1].trim(); // No regex validation, just taking input as-is

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


// ============================================================================

bot.onText(/\/getdefault/, async (msg) => {
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
    bot.sendMessage(msg.chat.id, `Default WalletId ${wallet.id}, Wallet Address: ${wallet.walletAddress}`);
  } catch (error) {
    bot.sendMessage(msg.chat.id, `Error: ${error}`);
  }
});



// ============================================================================

// complete txn history

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





// ============================================================================
// Funnd Transfer
// ============================================================================


bot.onText(/\/send (.+)/, async (msg, match: any) => {
  const session = userSessions[msg.chat.id];

  if (!session || !session.accessToken) {
    return bot.sendMessage(msg.chat.id, "❌ No active session. Verify OTP first.");
  }

  const args = match[1].split(" ");
  if (args.length < 6) {
    return bot.sendMessage(msg.chat.id, "⚠️ Incorrect usage. Use:\n/send <walletAddress> <email> <payeeId> <amount> <purposeCode> <currency>");
  }

  const [walletAddress, email, payeeId, amount, purposeCode, currency] = args;

  console.log("Received /send command with:", { walletAddress, email, payeeId, amount, purposeCode, currency });

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

    const message = response.data;

    bot.sendMessage(msg.chat.id, `✅ Transaction Successful! \n\n📌 *Details:*\nStatus: ${message.status}\nFrom: ${message.sourceCountry}\nTo: ${message.destinationCountry}\nAmount: ${message.amount} ${message.currency}`, { parse_mode: "Markdown" });
  } catch (error: any) {
    console.error("Error:", error.response ? error.response.data : error.message);
    bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
  }
});


// ============================================================================

bot.onText(/\/withdraw \s+(.+)/, async (msg, match: any) => {
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


// ============================================================================


bot.onText(/\/offramp (.+)/, async (msg, match : any) => {
  const chatId = msg.chat.id;
  const session = userSessions[chatId];

  if (!session || !session.accessToken) {
    return bot.sendMessage(chatId, `No active session found. Please authenticate first.`);
  }

  try {
    const input = match[1].trim();

    // Extract customerData
    const customerDataMatch = input.match(/({.*})/);
    if (!customerDataMatch) {
      return bot.sendMessage(chatId, `Invalid customerData format. Please enclose in {}.`);
    }
    const customerDataStr = customerDataMatch[0];
    let remainingInput = input.replace(customerDataStr, "").trim();

    // Extract note (optional)
    const noteMatch = remainingInput.match(/"([^"]+)"/);
    let note = noteMatch ? noteMatch[1] : null;
    if (noteMatch) {
      remainingInput = remainingInput.replace(`"${note}"`, "").trim();
    }

    // Split remaining parameters
    const otherParams = remainingInput.split(/\s+/).filter(Boolean);
    if (otherParams.length !== 9) {
      return bot.sendMessage(chatId, `Invalid format. Expected 9 params + customerData + optional note. Got ${otherParams.length}: ${otherParams.join(", ")}`);
    }

    const [invoiceNumber, invoiceUrl, purposeCode, sourceOfFunds, recipientRelationship, 
           quotePayload, quoteSignature, preferredWalletId, sourceOfFundsFile] = otherParams;

    // Parse customerData (only this should be JSON)
    let customerData;
    try {
      customerData = JSON.parse(customerDataStr);
      if (typeof customerData !== "object" || customerData === null) {
        throw new Error("customerData must be a JSON object");
      }
    } catch (error : any) {
      return bot.sendMessage(chatId, `Invalid customerData JSON: ${error.message}`);
    }

    // Construct request body (no JSON parsing for other fields)
    const requestBody = {
      invoiceNumber,
      invoiceUrl,
      purposeCode,
      sourceOfFunds,
      recipientRelationship,
      quotePayload, // Remains a string
      quoteSignature, // Remains a string
      preferredWalletId,
      customerData, // Parsed JSON object
      sourceOfFundsFile,
      note: note || "",
    };

    // Send API request
    const response = await axios.post(
      "https://income-api.copperx.io/api/transfers/offramp",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (response.data && response.data.id) {
      bot.sendMessage(chatId, `Offramp request successful! Transfer ID: ${response.data.id}`);
    } else {
      bot.sendMessage(chatId, `Unexpected response format from API.`);
    }

  } catch (error : any) {
    console.error(`Error: ${error}`);
    const errorMsg = error.response?.data?.message || error.message;
    bot.sendMessage(chatId, `Error: ${errorMsg}`);
  }
});

// ============================================================================


// Send Bulk TXN's 

bot.onText(/\/sendbatch (.+)/, async (msg, match: any) => {
  const chatId = msg.chat.id;
  const session = userSessions[chatId];

  if (!session || !session.accessToken) {
    return bot.sendMessage(chatId, `No active session found. Please authenticate first.`);
  }

  try {

    const input = match[1].trim();
    const requestStrings = input.split("|").map((req: any) => req.trim());

    // Validate and parse each request
    const requests = requestStrings.map((reqStr: any, index: number) => {
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
        .map((res: any) => {
          if (res.error && res.error.message) {
            return `Request ${res.requestId}: Failed - ${res.error.message || "Unknown error"}`;
          }
          return `Request ${res.requestId}: Success - Transfer ID: ${res.response.id}`;
        })
        .join("\n");
      bot.sendMessage(chatId, `Batch payment results:\n${reply}`);
    } else {
      bot.sendMessage(chatId, `Unexpected response format from API.`);
    }
  } catch (error: any) {
    console.error(`Error in /sendbatch: ${error.message}`, error);
    const errorMsg = error.response?.data?.message || error.message || "An unknown error occurred";
    bot.sendMessage(chatId, `❌ Error processing batch payment: ${errorMsg}`);
  }
});


// ============================================================================


// last 10 txn history


bot.onText(/\/Wtransfers(?:\s(.+))?/, async (msg, match: any) => {
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
    const response = await axios.get(`https://income-api.copperx.io/api/transfers?page=1&limit=1`, {
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


// ============================================================================
//  Org info 
// ============================================================================


bot.onText(/\/orgInfo/, async (msg)=>{
  const session = userSessions[msg.chat.id];
  if(!session || !session.accessToken) return bot.sendMessage(msg.chat.id, `No sessions found...`);

  try{
    const response = await axios.get("https://income-api.copperx.io/api/organization", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    const message = await response.data;

    bot.sendMessage(msg.chat.id, `Organization info : OrgId : ${message.id}.  OwnerId : ${message.ownerId}, Supported Email : ${message.supportEmail}`);
  }
  catch(error){
    console.error("Error fetching transfers:", error);
    bot.sendMessage(msg.chat.id, `❌ Error fetching info. : ${error}`);
  }
}); 

// ============================================================================
//  Notifications
// ============================================================================





bot.onText(/\/notification/, async (msg) => {
  const chatId = msg.chat.id;
  let session = userSessions[chatId];

  if (!session) {
    bot.sendMessage(chatId, `⚠️ No active session found.`);
    return;
  }

  // ✅ Prevent duplicate subscriptions
  if (session.isSubscribed) {
    bot.sendMessage(chatId, '⚠️ You are already subscribed to deposit notifications.');
    return;
  }

  session.isSubscribed = true; // ✅ Mark user as subscribed

  const pusherClient = initPusherClient(session);
  const channel = pusherClient.subscribe(`private-org-${ORGANIZATION_ID}`);

  channel.bind('pusher:subscription_succeeded', () => {
    bot.sendMessage(chatId, '✅ Subscribed to deposit notifications.');
  });

  channel.bind('pusher:subscription_error', (error: any) => {
    console.error('Subscription error:', error);
    bot.sendMessage(chatId, `❌ Subscription error: ${error.message}`);
  });

  channel.bind('deposit', (data: any) => {
    bot.sendMessage(
      chatId,
      `💰 *New Deposit Received*\n\n${data.amount} USDC deposited on Solana.`
    );
  });
});















