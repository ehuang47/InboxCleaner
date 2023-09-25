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

      //todo change maxThreads & maxResults for testing. limit is x/500
      let maxThreads = 3000,
        maxResults = 500,
        thread_count = 0,
        pageToken = "",
        threadParsingOperations = [];

      while (pageToken != null && thread_count < maxThreads && !storage.redundant_emails) {
        if (storage.redundant_emails) break;
        const threadList = await this.emailDao.getThreadList(pageToken, maxResults);
        thread_count += threadList.threads.length;
        pageToken = threadList.nextPageToken;
        console.log(thread_count, threadList.threads);
        for (const thread of threadList.threads) {
          if (storage.redundant_emails) break;
          const parsingOp = this.emailDao.getThreadData(thread)
            .then(async (threadData) => {
              const wasAlreadyParsed = emailUtils.checkAlreadyParsed(storage, threadData);
              if (wasAlreadyParsed) return;
              const threadPayload = threadData.messages[0].payload;
              const unsubLink = await emailUtils.getUnsubLink(threadPayload);
              if (!unsubLink) return;
              const { name, email } = emailUtils.getSender(threadPayload.headers);
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
