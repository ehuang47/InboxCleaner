import LoggerService from "../LoggerService";
import axios, { axiosWithRetry } from "../interceptor";
export default class EmailDao {
  _shared;
  logger;

  static get shared() {
    if (!this._shared) this._shared = new EmailDao(LoggerService.shared);
    return this._shared;
  }

  constructor(logger) {
    this.logger = logger;
  }

  async getUserProfile() {
    return this.logger.forRequests({
      callback: async () => {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/profile`;
        const res = await axios.get(url);
        return res.data;
      },
      loadingMsg: "Loading user profile",
      successMsg: "Loaded user profile",
      errorMsg: "failed to get user profile"
    });
  }

  async getThreadList(pageToken, maxResults) {
    return this.logger.forRequests({
      callback: async () => {
        const axios = axiosWithRetry(3);
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?`;
        const res = await axios.get(url, {
          params: { pageToken, maxResults }
        });
        return res.data;
      },
      loadingMsg: "Loading thread list",
      successMsg: "Loaded thread list",
      errorMsg: "failed to get thread list"
    });
  }

  async getThreadData(threadId) {
    return this.logger.forRequests({
      callback: async () => {
        const axios = axiosWithRetry(3, 30);
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`;
        const res = await axios.get(url);
        return res.data;
      },
      loadingMsg: "Loading thread data for id: " + threadId,
      successMsg: "Loaded thread data for id: " + threadId,
      errorMsg: "failed to get thread data"
    });
  }

  async trashThread(threadId) {
    return this.logger.forRequests({
      callback: async () => {
        const axios = axiosWithRetry(3);
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/trash`;
        const res = await axios.post(url);
        return res.data;
      },
      loadingMsg: "Trashing thread with id: " + threadId,
      successMsg: "Trashed thread with id: " + threadId,
      errorMsg: "failed to trash thread"
    });
  }
}
