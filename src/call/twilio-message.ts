import WebSocket from "ws";
import fs from "fs";
import type { CallSession } from "./types";
import { processTranscriptAndSend } from "./call-summary";

export const handleTwilioMessage = (
  data: WebSocket.RawData,
  session: CallSession,
  openAiWs: WebSocket,
) => {
  try {
    const getStringFromRawData = (
      data: WebSocket.RawData,
    ): string | undefined => {
      if (Buffer.isBuffer(data)) {
        return data.toString("utf-8");
      } else if (data instanceof ArrayBuffer) {
        return Buffer.from(data).toString("utf-8");
      } else {
        console.log("Received unknown data type", { data });
      }
    };

    const message = JSON.parse(getStringFromRawData(data) ?? "{}");

    switch (message.event) {
      case "media":
        if (openAiWs.readyState === WebSocket.OPEN) {
          const audioAppend = {
            type: "input_audio_buffer.append",
            audio: message.media.payload,
          };

          openAiWs.send(JSON.stringify(audioAppend));
        }
        break;
      case "start":
        session.streamSid = message.start.streamSid;
        session.incomingCall = JSON.parse(
          decodeURIComponent(
            message.start.customParameters.incomingCall.slice(1),
          ),
        );
        console.log(
          "Incoming stream has started",
          session.streamSid,
          session.incomingCall,
          // util.inspect(
          //     { data },
          //     { depth: null, colors: true },
          // ),
        );
        break;
      default:
        console.log("Received non-media event:", message.event);
        break;
    }
  } catch (error) {
    console.error("Error parsing message:", error, "Message:", data);
  }
};

export const handleTwilioWsClose = async (
  openAiWs: WebSocket,
  session: CallSession,
  sessions: Map<string, CallSession>,
) => {
  if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
  console.log(`Client disconnected (${session.id}).`);
  console.log("Full Transcript:");
  console.log(session.transcript);

  const parsedContent = await processTranscriptAndSend(session);

  // Save transcript to a file
  const transcriptFilePath = `transcripts/${session.id}.json`;
  fs.writeFileSync(
    transcriptFilePath,
    JSON.stringify(
      {
        sessionId: session.id,
        streamSid: session.streamSid,
        createdAt: session.createdAt,
        incomingCall: session.incomingCall,
        transcript: session.transcript,
        parsedContent,
      },
      null,
      2,
    ),
  );

  // Clean up the session
  sessions.delete(session.id);
};
