# Copperx Payout Telegram Bot

## Overview
The Copperx Payout Telegram Bot (Copperx_payout) allows users to manage USDC transactions directly through Telegram without visiting the Copperx web app. The bot integrates with the Copperx Payout API to facilitate deposits, withdrawals, and transfers.

## Features
- **Authentication & Account Management**: Secure login with Copperx credentials and KYC status checks.
- **Wallet Management**: View balances, set default wallets, and check transaction history.
- **Fund Transfers**: Send funds to email addresses, wallet addresses, or bank accounts.
- **Deposit Notifications**: Real-time notifications for new deposits via Pusher.
- **Interactive UI**: Command-based interaction with inline keyboards and natural language support.

## Tech Stack
- **Backend**: TypeScript/Node.js
- **API Integration**: Copperx Payout API
- **Real-time Notifications**: Pusher
- **Hosting**: Render

## Folder Structure
```
backend/
│
├── build/             # Compiled production code
├── dist/              # Distribution folder
├── node_modules/      # Node.js dependencies
├── .env               # Environment variables
├── .gitignore         # Git ignore file
├── nodemon.json       # Nodemon configuration
├── package.json       # Node.js package configuration
├── package-lock.json  # Lock file
├── tsconfig.json      # TypeScript configuration
└── src/               # Main TypeScript code
```

## Installation
1. Clone the repository:
```bash
git clone https://github.com/your-repo/copperx-payout-bot.git
```


2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root folder and add your environment variables:
```plaintext
COPPERX_API_KEY=your_api_key
PUSHER_KEY=your_pusher_key
PUSHER_CLUSTER=ap1
TELEGRAM_BOT_TOKEN=your_telegram_token
```

4. Run the bot in development mode:
```bash
npm run dev
```

## API Endpoints
### Authentication
- `/api/auth/email-otp/request`: Request OTP
- `/api/auth/email-otp/authenticate`: Authenticate with OTP
- `/api/auth/me`: User profile

### Wallet Management
- `/api/wallets`: Get wallets
- `/api/wallets/balances`: Get balances
- `/api/wallets/default`: Set default wallet
- `/api/transfers`: Transaction history

### Fund Transfers
- `/api/transfers/send`: Email transfer
- `/api/transfers/wallet-withdraw`: Wallet transfer
- `/api/transfers/offramp`: Bank withdrawal
- `/api/transfers/send-batch`: Bulk transfers

### Deposit Notifications
- `/api/notifications/auth`: Authenticate for Pusher

## Security Considerations
- Secure handling of user credentials and sensitive information
- Proper error handling and user feedback
- Session management and token refresh mechanism


```bash
git push render master
```

## Contributing
1. Fork the repository.
2. Create a feature branch:
```bash
git checkout -b feature-name
```
3. Commit your changes:
```bash
git commit -m "Add new feature"
```
4. Push to the branch:
```bash
git push origin feature-name
```
5. Open a pull request.

## License
MIT License

## Contact
- kartikdoda86@gmail.com

