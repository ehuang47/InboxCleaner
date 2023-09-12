import LoggerService from "../LoggerService";

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

  async getThreadList(pageToken, maxResults) {
    return this.logger.forRequests({
      callback: async () => {
        const queryParams = new URLSearchParams({ pageToken, maxResults });
        // for (const p of queryParams) {
        //   console.log(p);
        // }
        const { token } = await chrome.identity.getAuthToken({ interactive: true });
        const options = {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        };
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?` + queryParams;
        const data = await fetch(url, options);
        return data.json();
      },
      loadingMsg: "Loading thread list",
      successMsg: "Loaded thread list",
      errorMsg: "failed to get thread list"
    });
  }

  async getThreadData(thread) {
    return this.logger.forRequests({
      callback: async () => {
        const { token } = await chrome.identity.getAuthToken({ interactive: true });
        const options = {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        };

        const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}`;
        const data = await fetch(url, options);
        return data.json();
      },
      loadingMsg: "Loading thread data for id: " + thread.id,
      successMsg: "Loaded thread data for id: " + thread.id,
      errorMsg: "failed to get thread data"
    });
  }
}
