import Fastify from 'fastify';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import { logger } from './utils/console-logger';
import { handleMediaStream, handleIncomingCall, type CallSession } from './call';

// Load environment variables from .env file
dotenv.config();

const loggerContext = 'Server';

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Session management
const sessions = new Map<string, CallSession>();

// Route for Twilio to handle incoming and outgoing calls
fastify.all('/incoming-call', handleIncomingCall);

// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (twilioWs, req) =>
        handleMediaStream(twilioWs, req, sessions)
    );
});

// Root Route
fastify.get('/', async (_request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

const PORT = Number(process.env.PORT) ?? 3000;
fastify.listen({ port: PORT }, (err) => {
    if (err) {
        logger.error('Error', err, undefined, loggerContext);
        process.exit(1);
    }
    logger.log(
        `Server is listening on port ${PORT}`,
        { deployed: process.env.REPLIT_DEPLOYMENT === '1' },
        loggerContext
    );
});
