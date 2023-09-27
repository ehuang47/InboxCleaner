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

  async syncAllThreads() {
    try {
      const storage = await emailUtils.getStoredThreads();
      let hasParsedThreadBefore = false;

      const { threadsTotal } = await this.emailDao.getUserProfile();
      let maxThreads = threadsTotal,
        maxResults = 250,
        numThreadsParsed = 0,
        pageToken = "",
        threadParsingOperations = [];

      while (pageToken != null && numThreadsParsed < maxThreads && !hasParsedThreadBefore) {
        const threadList = await this.emailDao.getThreadList(pageToken, maxResults);
        numThreadsParsed += threadList.threads.length;
        pageToken = threadList.nextPageToken;
        this.logger.log({
          data: threadList.threads,
          message: `parsed ${numThreadsParsed} threads`,
          type: "info"
        });
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
      }
      await emailUtils.updateStoredThreads(storage);
    } catch (e) {
      this.logger.log({
        message: e,
        type: "error"
      });
      throw new Error("Error syncing all threads");
    }
  }

  async trashAllSenderThreads(sender) {
    try {
      let start = new Date().getTime();

      const storage = await emailUtils.getStoredThreads();
      const threadIdList = storage[c.ALL_SUBS][sender].threadIdList;
      let trashOps = [];
      for (let i = 0; i < threadIdList.length; i += 5) { // batch 10 requests per time
        for (let j = i; (j < i + 5) && (j < threadIdList.length); j++) {
          const threadId = threadIdList[j];
          trashOps.push(this.emailDao.trashThread(threadId));
        }
        await Promise.all(trashOps);
        this.logger.log({
          message: `trashed ${trashOps.length} threads`,
        });
        trashOps = [];
      }

      let elapsed = new Date().getTime() - start;
      var mins = elapsed / 60000;
      this.logger.log({
        message: mins.toFixed(3) + " min, " + (elapsed / 1000 - mins * 60).toFixed(3) + " sec",
      });
    } catch (e) {
      this.logger.log({
        message: e,
        type: "error"
      });
      throw new Error("Error trashing all sender's threads");
    }
  }
}
