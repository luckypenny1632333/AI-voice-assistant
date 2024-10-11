import type { FastifyRequest, FastifyReply } from "fastify";
import { omit } from "lodash-es";
import { getTwilioMLResponse } from "../providers/twilio";
import { logger } from "../utils/console-logger";

const loggerContext = "IncomingCall";

// Route for Twilio to handle incoming and outgoing calls
export const handleIncomingCall = async (
    request: FastifyRequest,
    reply: FastifyReply,
) => {
    const requestBody = request.body as Record<string, undefined>;
    if (typeof requestBody !== "object") return;

    const incomingCall = omit(requestBody, ["CallToken"]);
    logger.log(
        `Incoming call from (${incomingCall.CallerCountry}) ${incomingCall.Caller}`,
        undefined,
        loggerContext,
    );

    const twiMlResponse = getTwilioMLResponse(
        `wss://${request.headers.host}/media-stream`,
        "", // `<Say language="de-DE">Hallo?</Say>`
        { incomingCall },
    );

    reply.type("text/xml").send(twiMlResponse);
};
