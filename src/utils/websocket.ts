import WebSocket from "ws";

export const getStringFromRawData = (
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
