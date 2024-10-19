import axios from 'axios';

export const getMessageFromUnknownError = (error: unknown): string =>
  axios.isAxiosError(error)
    ? error.response?.data || error.message
    : error instanceof Error
      ? error.message
      : JSON.stringify(error);
