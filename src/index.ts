import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.Tbot_token;

if (!token) {
  throw new Error("Telegram Bot Token not provided!");
}

console.log(`Token: ${token}`);

const bot = new TelegramBot(token || "", { polling: true });

type CommandHandler = {
  [key: string]: (chatId: number, amount?: number) => void;
};
const balance = new Map<number, number>();

const updateBalance = (chatId : number, newbalance: number)=>{
    balance.set(chatId, newbalance);
}

const getBalance = (chatId : number)=>{
    if(!balance.has(chatId)){
        balance.set(chatId, 100);
    }
    return balance.get(chatId)
}

const handleCommand = (chatId: number, text: string) => {
    const [command, arg] = text.split(" ");
    const amount = arg ? parseInt(arg) : undefined;
    const currentBalance = getBalance(chatId);
    if(!currentBalance) return;

    const commands: CommandHandler = {
        "/start": () => bot.sendMessage(chatId, "Welcome to Bank of Varodra."),
        "/balance": () => bot.sendMessage(chatId, `Your balance: ₹${currentBalance.toString()}`),
        
        "/withdraw": (chatId, amount) => {
            
            if (!amount || isNaN(amount) || amount <= 0) {
                bot.sendMessage(chatId, "Invalid withdrawal amount.");
                return;
            }
      const newBalance = currentBalance - amount;
      updateBalance(chatId, newBalance);
      
      bot.sendMessage(chatId, `Withdrawn: ₹${amount}. New balance: ₹${newBalance}`);
    },
    "/deposit": (chatId, amount) => {
      if (!amount || isNaN(amount) || amount <= 0) {
        bot.sendMessage(chatId, "Invalid deposit amount.");
        return;
      }
      const newBalance =currentBalance + amount;
      updateBalance(chatId, newBalance)
      bot.sendMessage(chatId, `Deposited: ₹${amount}. New balance: ₹${newBalance}`);
    },
  };

  const action = commands[command];
  if (action) {
    action(chatId, amount);
  } else {
    bot.sendMessage(chatId, "Unknown command.");
  }
};

bot.on("message", (message) => {
  const chatId = message.chat.id;
  const text = message.text || "";
  handleCommand(chatId, text);
});
