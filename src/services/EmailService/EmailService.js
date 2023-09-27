import * as emailUtils from "./utils";
import LoggerService from "../LoggerService";
import EmailDao from "./EmailDao";
import * as c from "../../constants";

export default class EmailService {
  _shared;
  logger;
  emailDao;

  static get shared() {
    if (!this._shared) this._shared = new EmailService(LoggerService.shared, EmailDao.shared);
    return this._shared;
  }

  constructor(logger, emailDao) {
    this.logger = logger;
    this.emailDao = emailDao;
  }

  async getUserProfile() {
    const profileData = await this.emailDao.getUserProfile();
    return profileData;
  }

  async syncAllThreads({ sendProgress }) {
    const { emailAddress, threadsTotal } = await this.emailDao.getUserProfile();
    const storage = await emailUtils.getStoredThreads(emailAddress);

    try {
      const start = new Date().getTime(); // just for testing durations

      storage[c.IS_SYNCING] = true;
      await chrome.storage.local.set({ [emailAddress]: { ...storage } });

      this.logger.log({
        message: "Sync in progress. Last synced at: " + storage.last_synced,
        type: "info"
      });

      let maxThreads = 50; // 50 for testing, threadsTotal for prod
      let maxResults = 25; // 25 for testing, 250 for prod
      let numThreadsParsed = 0;
      let hasParsedThreadBefore = false;
      let pageToken = "";
      let threadParsingOperations = [];

      while (pageToken != null && numThreadsParsed < maxThreads && !hasParsedThreadBefore) {
        const threadList = await this.emailDao.getThreadList(pageToken, maxResults);
        numThreadsParsed += threadList.threads.length;
        pageToken = threadList.nextPageToken;
        for (const thread of threadList.threads) {
          if (hasParsedThreadBefore) break;
          const parsingOp = this.emailDao.getThreadData(thread.id)
            .then(async (threadData) => {
              const { internalDate, payload } = threadData.messages[0];
              hasParsedThreadBefore = internalDate < storage[c.LAST_SYNCED];
              if (hasParsedThreadBefore) return;

              const { name, email } = emailUtils.getSender(payload.headers);

              if (!storage[c.ALL_SUBS].hasOwnProperty(email)) {
                storage[c.ALL_SUBS][email] = { name, threadIdList: [threadData.id] };
              } else {
                const subData = storage[c.ALL_SUBS][email];
                subData.threadIdList.push(threadData.id);
                storage[c.ALL_SUBS][email] = subData;
              }

              const subData = storage[c.ALL_SUBS][email];
              if (subData.hasOwnProperty("unsubLink")) return;
              const unsubLink = await emailUtils.getUnsubLink(payload);
              if (unsubLink) {
                subData.unsubLink = unsubLink;
                storage[c.ALL_SUBS][email] = subData;
              }
            });

          threadParsingOperations.push(parsingOp);
        }
        await Promise.all(threadParsingOperations);
        threadParsingOperations = [];

        this.logger.log({
          data: threadList.threads,
          message: `parsed ${numThreadsParsed} threads`,
        });
        sendProgress(numThreadsParsed);
      }
      this.logger.log({
        data: storage.all_subs,
        message: `updated storage with ${emailAddress}'s new subscriber list`,
      });

      let elapsed = new Date().getTime() - start;
      var mins = elapsed / 60000;
      this.logger.log({
        message: mins.toFixed(3) + " min, " + (elapsed / 1000 - mins * 60).toFixed(3) + " sec to sync all threads",
      });
    } catch (e) {
      this.logger.log({
        message: e,
        type: "error"
      });
      throw new Error("Error syncing all threads");
    } finally {
      storage[c.IS_SYNCING] = false;
      await chrome.storage.local.set({ [emailAddress]: { ...storage } });
    }
  }

  async trashAllSenderThreads({ sender, sendProgress }) {
    try {
      const start = new Date().getTime();

      const { emailAddress } = await this.emailDao.getUserProfile();
      const storage = await emailUtils.getStoredThreads(emailAddress);
      storage[c.IS_TRASHING] = true;
      await chrome.storage.local.set({ [emailAddress]: { ...storage } });

      const threadIdList = storage[c.ALL_SUBS][sender].threadIdList;
      let trashOps = [];
      for (let i = 0; i < threadIdList.length; i += 5) { // batch 10 requests per time
        for (let j = i; (j < i + 5) && (j < threadIdList.length); j++) {
          const threadId = threadIdList[j];
          trashOps.push(this.emailDao.trashThread(threadId));
        }
        await Promise.all(trashOps);
        trashOps = [];
        this.logger.log({
          message: `trashed ${i + 5} threads`,
        });
        sendProgress(i + 5, threadIdList.length);
      }

      let elapsed = new Date().getTime() - start;
      var mins = elapsed / 60000;
      this.logger.log({
        message: mins.toFixed(3) + " min, " + (elapsed / 1000 - mins * 60).toFixed(3) + " sec to trash all sender threads",
      });
    } catch (e) {
      this.logger.log({
        message: e,
        type: "error"
      });
      throw new Error("Error trashing all sender's threads");
    } finally {
      storage[c.IS_TRASHING] = false;
      await chrome.storage.local.set({ [emailAddress]: { ...storage } });
    }
  }

  async resetAccountSubscriptions() {
    const { emailAddress } = await this.emailDao.getUserProfile();
    await chrome.storage.local.remove(emailAddress);
  }
}
