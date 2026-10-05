import { getSafeStorage } from "./storage";

const INITIAL_UNREAD_THREAD_IDS = ["msg-1", "msg-2"];
const INBOX_READ_EVENT = "jobpilot:data-changed";

function getReadThreadIds(userId: string): Set<string> {
  const storage = getSafeStorage();
  if (!storage) return new Set();

  try {
    const raw = storage.getItem(`jobpilot_inbox_read_${userId}`);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function isInboxThreadUnread(userId: string | undefined, threadId: string, initialUnread: boolean) {
  if (!initialUnread || !userId) return false;
  return !getReadThreadIds(userId).has(threadId);
}

export function getUnreadInboxCount(userId: string): number {
  const readIds = getReadThreadIds(userId);
  return INITIAL_UNREAD_THREAD_IDS.filter((id) => !readIds.has(id)).length;
}

export function markInboxThreadRead(userId: string | undefined, threadId: string): void {
  if (!userId) return;
  const storage = getSafeStorage();
  if (!storage) return;

  const readIds = getReadThreadIds(userId);
  readIds.add(threadId);
  storage.setItem(`jobpilot_inbox_read_${userId}`, JSON.stringify([...readIds]));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(INBOX_READ_EVENT));
}
