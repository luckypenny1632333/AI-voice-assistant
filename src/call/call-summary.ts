import { CallSummarySchema, type CallSession, type CallSummary } from "./types";
import { zodResponseFormat } from "openai/helpers/zod";
import { pick } from "lodash";
import { openai } from "../providers/openai";
import axios from "axios";
import { logger } from "../utils/console-logger";

const WEBHOOK_URL = "https://lx0.app.n8n.cloud/webhook/call-completion";

// Function to make ChatGPT API completion call with structured outputs
async function extractCallSummary(
    session: CallSession,
): Promise<CallSummary | null> {
    logger.log("Starting ChatGPT API call...");
    try {
        const completion = await openai.beta.chat.completions.parse({
            model: "gpt-4o-2024-08-06",
            messages: [
                {
                    role: "system",
                    content:
                        "Create a call summary. Extract customer details: name, communication language, availability, and any special notes from the transcript. Reply in German.",
                },
                {
                    role: "user",
                    content: JSON.stringify(
                        pick(session, [
                            "createdAt",
                            "incomingCall",
                            "transcript",
                        ]),
                    ),
                },
            ],
            response_format: zodResponseFormat(
                CallSummarySchema,
                "call_summary",
            ),
        });

        const message = completion.choices[0].message.parsed;

        logger.log("ChatGPT API response:", { message });

        return message;
    } catch (error) {
        logger.error("Error making ChatGPT completion call:", error);
        throw error;
    }
}

// Function to send data to Make.com webhook
async function sendToWebhook(payload: {
    session: CallSession;
    callSummary: CallSummary;
}): Promise<boolean> {
    logger.log("Sending data to webhook:", payload);
    try {
        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        logger.log("Webhook response:", {
            status: response.status,
            data: response.data,
        });
        return true;
    } catch (error) {
        logger.error("Error sending data to webhook:", error);
    }
    return false;
}

// Main function to extract and send customer details
export async function processTranscriptAndSend(
    session: CallSession,
): Promise<CallSummary | null> {
    logger.log(`Starting transcript processing for session ${session.id}...`);
    try {
        // Make the ChatGPT completion call
        const callSummary = await extractCallSummary(session);

        if (callSummary) {
            // Send the parsed content directly to the webhook
            const webhookResponse = await sendToWebhook({
                session,
                callSummary,
            });
            logger.log("Extracted and sent customer details:", callSummary);
            return callSummary;
        } else {
            logger.error("Unexpected response structure from ChatGPT API");
        }
    } catch (error) {
        logger.error("Error in processTranscriptAndSend:", error);
    }

    return null;
}
