import { dbGet } from "@/services/persistence/db";
import { trackedSave } from "@/services/persistence/saveStatus";
import { MAIL_STORAGE_KEY, MAIL_STORAGE_STORE, type MailSaveRecord } from "./mailTypes";

export interface MailPersistence {
  load: () => Promise<unknown>;
  save: (record: MailSaveRecord) => Promise<boolean>;
}

/**
 * Mail uses the existing `chat` object store under its own key. The database
 * schema version is unchanged, and team chat (`chat/state`) is untouched.
 */
export const defaultMailPersistence: MailPersistence = {
  load: () => dbGet<unknown>(MAIL_STORAGE_STORE, MAIL_STORAGE_KEY),
  save: (record) => trackedSave(MAIL_STORAGE_STORE, MAIL_STORAGE_KEY, record),
};
