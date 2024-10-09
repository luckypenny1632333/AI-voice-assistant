import type { FastifyRequest, FastifyReply } from "fastify";
import { omit } from "lodash";
import { getTwilioMLResponse } from "../providers/twilio";

// Route for Twilio to handle incoming and outgoing calls
export const handleIncomingCall = async (
    request: FastifyRequest,
    reply: FastifyReply,
) => {
    const requestBody = request.body as Record<string, undefined>;
    if (typeof requestBody !== "object") return;

    const incomingCall = omit(requestBody, ["CallToken"]);
    console.log(
        `Incoming call from (${incomingCall.CallerCountry}) ${incomingCall.Caller}`,
    );

    const twiMlResponse = getTwilioMLResponse(
        `wss://${request.headers.host}/media-stream`,
        "", // `<Say language="de-DE">Hallo?</Say>`
        { incomingCall },
    );

    reply.type("text/xml").send(twiMlResponse);
};
