import dotenv from 'dotenv';
import { logger } from '../utils/console-logger';
import { getLanguageByCountryCode } from '../utils/get-language-by-country-code';
import {
    serviceUnavailableMessage,
    serviceUnavailableMessageLanguage,
} from '../config/serviceUnavailableMessage';

const loggerContext = 'Twilio';

dotenv.config(); // Load environment variables from .env

export const getTwilioMLResponse = (
    url: string,
    connectionMessage: string,
    parameters: Record<string, Record<string, undefined>>
) => `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
          ${connectionMessage}
          <Connect>
              <Stream url="${url}">
                  ${Object.entries(parameters)
                      .map(
                          ([key, value]) =>
                              `<Parameter name="${key}" value="\\${encodeURIComponent(JSON.stringify(value))}" />`
                      )
                      .join('')}
              </Stream>
          </Connect>
      </Response>`;

export const twilioMLErrorResponse = (
    language: string = serviceUnavailableMessageLanguage
) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="${language}">${serviceUnavailableMessage}</Say>
    <Pause length="1" />
    <Hangup />
</Response>`; // TODO translate serviceUnavailableMessage to serviceUnavailableMessageLanguage

export const endCall = async (callSid: string, callerCountry: string) => {
    // Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;

    const params = new URLSearchParams();
    params.append('Twiml', twilioMLErrorResponse(getLanguageByCountryCode(callerCountry)));

    // Make the HTTP request to Twilio REST API
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization:
                    'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        if (response.ok) {
            logger.log(
                `Call ${callSid} ended with TwiML message.`,
                undefined, // { response },
                loggerContext
            );
        } else {
            const responseText = await response.text();
            logger.error(
                `Failed to update call ${callSid}: ${response.status} - ${responseText}`,
                undefined,
                undefined,
                loggerContext
            );
        }
    } catch (err) {
        logger.error(`Failed to update call ${callSid}:`, err, undefined, loggerContext);
    }
};
