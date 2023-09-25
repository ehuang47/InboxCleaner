import * as emailUtils from "./utils";
import LoggerService from "../LoggerService";
import EmailDao from "./EmailDao";

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

      // const { threadsTotal } = await this.emailDao.getUserProfile();
      let maxThreads = 500, // threadsTotal
        maxResults = 500,
        numThreadsParsed = 0,
        pageToken = "",
        threadParsingOperations = [];

      while (pageToken != null && numThreadsParsed < maxThreads && !hasParsedThreadBefore) {
        const threadList = await this.emailDao.getThreadList(pageToken, maxResults);
        numThreadsParsed += threadList.threads.length;
        pageToken = threadList.nextPageToken;
        console.log(numThreadsParsed, threadList.threads);
        for (const thread of threadList.threads) {
          if (hasParsedThreadBefore) break;
          const parsingOp = this.emailDao.getThreadData(thread.id)
            .then(async (threadData) => {
              const { internalDate, payload } = threadData.messages[0];
              hasParsedThreadBefore = internalDate < storage.last_synced;
              if (hasParsedThreadBefore) return;
              const unsubLink = await emailUtils.getUnsubLink(payload);
              if (!unsubLink) return;
              const { name, email } = emailUtils.getSender(payload.headers);
              if (!storage.all_subs.hasOwnProperty(email)) {
                storage.all_subs[email] = [name, unsubLink, true, [threadData.id]];
              } else {
                storage.all_subs[email][3].push(threadData.id);
              }
            });

          threadParsingOperations.push(parsingOp);
        }
      }

      await Promise.all(threadParsingOperations); // finish processing all thread lists
      await emailUtils.updateStoredThreads(storage);
    } catch (e) {
      console.log(e);
      console.trace();
      this.logger.log({
        message: e.message,
        type: "error"
      });
    }
  }

  async trashAllSenderThreads(sender) {
    try {
      const storage = await emailUtils.getStoredThreads();
      const threadIds = storage.all_subs[sender][3];
      threadIds.forEach(threadId => {
        this.emailDao.trashThread(threadId);
      });
    } catch (e) {
      console.log(e);
      console.trace();
      this.logger.log({
        message: e.message,
        type: "error"
      });
    }
  }
}
