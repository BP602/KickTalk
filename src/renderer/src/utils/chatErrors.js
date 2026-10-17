import { CHAT_ERROR_CODES } from "@utils/constants";

export const getChatSendFailure = (error) => {
  const candidateStatus = error?.response?.status ?? error?.status;
  const status = Number.isInteger(candidateStatus) && candidateStatus >= 100 && candidateStatus <= 599
    ? candidateStatus : undefined;
  const failureStatus = status ?? error?.response?.data?.status?.code;
  const candidateCode = error?.response?.data?.status?.message || error?.code;
  let code = "UNKNOWN_SEND_ERROR";
  let reason = "An error occurred while sending your message.";
  if (['SEND_TIMEOUT', 'ETIMEDOUT', 'ECONNABORTED'].includes(candidateCode)) {
    code = "SEND_TIMEOUT";
    reason = "Delivery could not be confirmed. Your message may have been sent; check chat before retrying.";
  } else {
    if (failureStatus === 401) code = "Unauthorized";
    else if (failureStatus === 429) code = "CHAT_RATE_LIMIT_ERROR";
    else if (typeof candidateCode === 'string' && Object.hasOwn(CHAT_ERROR_CODES, candidateCode)) code = candidateCode;
    if (Object.hasOwn(CHAT_ERROR_CODES, code)) reason = CHAT_ERROR_CODES[code];
  }
  return { code, reason, ...(status === undefined ? {} : { status }) };
};

export const chatroomErrorHandler = (error) => getChatSendFailure(error).reason;
