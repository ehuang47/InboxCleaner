import * as env from "../env";
export default class LoggerService {
  _shared;

  static get shared() {
    if (!this._shared) this._shared = new LoggerService();
    return this._shared;
  }

  constructor() { }

  log({ data, message, type = "success" }) {
    if (!env.LOGS_ENABLED) {
      return;
    }

    console.log(`%c--LOGGER-- %c${message}`, "color: #717171", getTitleColor());
    if (data) console.log(data);

    function getTitleColor() {
      switch (type) {
        case "error": return "color: #d93e3e;";
        case "info": return "color: #1670d2;";
        default: return "color: #548a54;";
      }
    }
  }

  async forRequests({ callback, successMsg, loadingMsg, errorMsg }) {
    try {
      // this.log({
      //   message: loadingMsg,
      //   type: "info"
      // });
      const successData = await callback();
      // this.log({
      //   data: successData,
      //   message: successMsg
      // });
      return successData;
    } catch (e) {
      this.log({
        message: e.message,
        type: "error"
      });
      throw new Error(errorMsg);
    }

  }
}
