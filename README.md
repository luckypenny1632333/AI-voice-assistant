# AI Voice Assistant - Twilio & OpenAI Integration

A sophisticated AI-powered voice assistant that handles incoming phone calls and provides a web-based chat interface. Built with TypeScript, Fastify, and OpenAI's Realtime API, this system integrates with Twilio for telephony services and includes advanced features like memory management, calendar integration, and webhook-based data processing.

## 🚀 Features

### Core Functionality
- **Real-time Voice Processing**: Handles incoming Twilio calls with OpenAI's Realtime API
- **Intelligent Chat Interface**: Web-based chat system for testing and demonstration
- **Multi-modal Communication**: Supports both voice and text interactions
- **Memory Management**: Persistent memory system for customer context and preferences
- **Calendar Integration**: Automated appointment scheduling and availability checking
- **Webhook Integration**: Extensible data processing through external webhook services

### Advanced Capabilities
- **Speech-to-Text**: Real-time audio transcription using Whisper
- **Natural Language Processing**: GPT-4 powered conversation handling
- **Tool-based Architecture**: Modular function calling system for extensibility
- **Session Management**: Comprehensive call session tracking and logging
- **Error Handling**: Robust error management with graceful fallbacks
- **Rate Limiting**: Built-in protection against abuse

## 🏗️ Architecture

### Project Structure
```
src/
├── agent/           # AI agent configuration and tools
├── call/            # Twilio call handling and OpenAI integration
├── config/          # Application configuration
├── data-sources/    # Database and data layer
├── providers/       # External service providers (Twilio, OpenAI)
├── services/        # Business logic services
├── utils/           # Utility functions and helpers
└── server.ts        # Main application entry point
```

### Key Components
- **Agent System**: Configurable AI agent with tool-based architecture
- **Call Management**: Twilio WebSocket integration for real-time audio
- **Memory System**: Persistent storage for customer data and preferences
- **Webhook Service**: External API integration for data processing
- **Chat Service**: Web-based interface for testing and demonstration

## 🛠️ Technologies

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Fastify with WebSocket support
- **AI/ML**: OpenAI GPT-4 and Realtime API
- **Telephony**: Twilio Voice API
- **Database**: TypeORM with PostgreSQL support
- **Validation**: Zod for schema validation
- **Styling**: Tailwind CSS for web interface
- **Development**: tsx, Prettier, ESLint

## ⚙️ Setup

### Prerequisites
- Node.js 20 or higher
- PostgreSQL database (optional, for data persistence)
- Twilio account with Voice API access
- OpenAI API key with Realtime API access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AI-voice-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```bash
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   
   # Twilio Configuration
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   
   # Webhook Configuration
   WEBHOOK_URL=your_webhook_endpoint_url
   WEBHOOK_TOKEN=your_webhook_authentication_token
   
   # Database Configuration (optional)
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   
   # Application Configuration
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## 🎯 Usage

### Voice Calls
1. Configure your Twilio phone number to point to your server's `/incoming-call` endpoint
2. The AI agent will automatically handle incoming calls
3. Customers can speak naturally, and the system will process their requests
4. The agent can schedule appointments, check availability, and manage customer data

### Chat Interface
1. Navigate to `http://localhost:3000/chat` in your web browser
2. Use the web interface to test the AI agent's capabilities
3. Try suggested prompts or type your own messages
4. The interface shows tool calls, system messages, and conversation history

### Available Tools
- **Memory Management**: Store and retrieve customer information
- **Calendar Operations**: Check availability and schedule appointments
- **Web Scraping**: Extract information from websites
- **Call Management**: End calls and manage call sessions

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server with hot reload
npm run start        # Start production server
npm run build        # Compile TypeScript (if needed)
npm run format       # Format code with Prettier
npm run reset        # Clean install dependencies
```

### Code Structure
- **Agent Configuration**: Define AI behavior and available tools in `src/agent/`
- **Call Handling**: Implement call logic in `src/call/`
- **Service Layer**: Add business logic in `src/services/`
- **Utilities**: Common functions in `src/utils/`

### Adding New Tools
1. Define tool schema in `src/agent/tools.ts`
2. Implement tool logic in appropriate service
3. Register tool in the agent configuration
4. Test using the chat interface

## 🌐 API Endpoints

- `GET /` - Health check endpoint
- `POST /incoming-call` - Twilio webhook for incoming calls
- `GET /media-stream` - WebSocket endpoint for real-time audio
- `GET /chat` - Serve chat interface
- `POST /chat` - Handle chat messages

## 🔒 Security Considerations

- Environment variables for sensitive configuration
- Rate limiting on API endpoints
- Input validation using Zod schemas
- Secure webhook authentication
- Error handling without information leakage

## 📝 License

This project is licensed under the ISC License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚠️ Production Notes

This project is designed for demonstration and development purposes. For production deployment, consider:

- Implementing proper authentication and authorization
- Adding comprehensive logging and monitoring
- Setting up proper error tracking and alerting
- Ensuring compliance with telephony regulations
- Implementing proper data privacy measures
- Adding comprehensive testing coverage
