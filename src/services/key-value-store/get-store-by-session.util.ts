import { CallSessionService, type CallSession } from '../../services/call-session';
import { KeyValueStoreService } from './key-value-store.service';

export const getStoreBySession = (session: CallSession): KeyValueStoreService => {
  const appId = CallSessionService.getAppId(session);
  const callerId = CallSessionService.getCallerId(session);
  if (!appId || !callerId) {
    throw new Error(`KeyValueStoreService cannot be initialized: App ID or caller ID not defined.`);
  }
  return new KeyValueStoreService(appId, callerId);
};
