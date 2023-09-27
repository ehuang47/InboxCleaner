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
        // let maxThreads = 2500,
        maxResults = 500,
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

              if (!storage[c.SENDER_THREADS].hasOwnProperty(email)) {
                storage[c.SENDER_THREADS][email] = [threadData.id];
              } else {
                storage[c.SENDER_THREADS][email].push(threadData.id);
              }

              const unsubLink = await emailUtils.getUnsubLink(payload);
              if (unsubLink != null && !storage[c.ALL_SUBS].hasOwnProperty(email)) {
                storage[c.ALL_SUBS][email] = { name, unsubLink };
              }
            });

          threadParsingOperations.push(parsingOp);
        }
        await Promise.all(threadParsingOperations); // batch 500 requests, finish before sending the next 500 requests
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
      const storage = await emailUtils.getStoredThreads();
      const threadIds = storage[c.SENDER_THREADS][sender];
      let trashOps = [];
      for (let i = 0; i < threadIds.length; i += 10) { // batch 10 requests per time
        for (let j = i; (j < i + 10) && (j < threadIds.length); j++) {
          const threadId = threadIds[j];
          trashOps.push(this.emailDao.trashThread(threadId));
        }
        await Promise.all(trashOps);
        trashOps = [];
      }
      return Promise.all(trashOperations);
    } catch (e) {
      this.logger.log({
        message: e,
        type: "error"
      });
      throw new Error("Error trashing all sender's threads");
    }
  }
}
