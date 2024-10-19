# OpenAI Realtime API Voice Assistant

This project implements an AI-powered inbound call agent and chat interface using OpenAI's GPT models. It integrates with Twilio for handling incoming phone calls and provides a web-based chat interface for testing and demonstration purposes.

## Features

- Handles incoming calls using Twilio's voice services
- Utilizes OpenAI's GPT models for natural language processing
- Transcribes user speech and generates AI responses in real-time
- Provides a web-based chat interface for testing and demonstration
- Extracts customer details from conversations
- Sends extracted information to a webhook for further processing

## Technologies Used

- Node.js
- TypeScript
- Fastify (web framework)
- WebSocket (for real-time communication)
- OpenAI GPT-4 API
- Twilio (for telephony services)
- dotenv (for environment variable management)

## Setup

1. Clone the repository:

   ```bash
   git clone [Your Repository URL]
   cd [Your Project Directory]
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following:

   ```bash
   OPENAI_API_KEY=your_openai_api_key
   ```

   Replace `your_openai_api_key` with your actual OpenAI API key.

4. Update the webhook URL:
   Locate the webhook configuration in your code and replace it with your own webhook URL.

5. Start the server:

   ```bash
   npm run dev
   ```

## Usage

- For voice calls: Once the server is running, it will handle incoming Twilio calls. The AI agent will engage with callers, transcribe their speech, generate appropriate responses, and extract relevant information from the conversation.

- For chat interface: Access the chat interface by navigating to `http://localhost:[YOUR_PORT]/chat` in your web browser.

## Development

- Use `npm run dev` to start the server in development mode with hot reloading.
- Use `npm run build` to compile TypeScript files.
- Use `npm run format` to format the code using Prettier.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.

## Note

This project is a demonstration and should be adapted for production use, including proper error handling, security measures, and compliance with relevant regulations.
