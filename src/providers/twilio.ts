export const getTwilioMLResponse = (
    url: string,
    connectionMessage: string,
    parameters: Record<string, Record<string, undefined>>,
) => `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
          ${connectionMessage}
          <Connect>
              <Stream url="${url}">
                  ${Object.entries(parameters)
                      .map(
                          ([key, value]) =>
                              `<Parameter name="${key}" value="\\${encodeURIComponent(JSON.stringify(value))}" />`,
                      )
                      .join("")}
              </Stream>
          </Connect>
      </Response>`;
