import "regenerator-runtime/runtime";
import axios from "axios";
import fetchAdapter from "./vespaiach/axios-fetch-adapter";
import logger from "./LoggerService";
/* Useful config properties
baseURL, timeout, params, headers, data,
xsrfCookieName, xsrfHeaderName, cancelToken, withCredentials
*/
export function axiosWithRetry(retryCount = 0) {
  let counter = 0;
  const ax = axios.create({
    timeout: 5000,
    adapter: fetchAdapter
  });

  ax.interceptors.request.use(async (config) => {
    const { token } = await chrome.identity.getAuthToken({ interactive: true });
    if (config.headers) config.headers["Authorization"] = `Bearer ${token}`;
    else config.headers = { "Authorization": `Bearer ${token}` };
    return config;
  }, (e) => {
    logger.shared.log({
      data: e,
      message: "Request Error: ",
      type: "error"
    });
    return Promise.reject(e);
  });

  ax.interceptors.response.use((res) => {
    // Status 2xx
    return res;
  }, (e) => {
    // Status not 2xx
    // Handle individual status codes, maybe clearing cookies/storage
    // If unauthorized, send another request for a refresh token
    logger.shared.log({
      data: e,
      message: `${counter} times, Response Error: `,
      type: "error"
    });
    switch (e.response?.status) {
      case 401:
        break;
      case 403: // https://stackoverflow.com/questions/56074531/how-to-retry-5xx-requests-using-axios
        if (counter < retryCount) {
          counter++;
          return new Promise(resolve => {
            setTimeout(() => {
              resolve(ax(e.config));
            }, ((2 ** counter) * 1000));
          });
        }
        break;
      case 404:
        break;
      case 500:
        break;
      case 503:
        break;
      default:
        break;
    }
    return Promise.reject(e);
    // if (e) {
    //   if (e.response && e.response.status === 401)
    //     window.location.href = "/login";
    // } else if (
    //   e.code === "ERR_NETWORK" ||
    //   (e.response && e.response.status === 502)
    // ) {

    // } else {
    //   return Promise.reject(e);
    // }
  });

  return ax;
}
const ax = axiosWithRetry();
export default ax;

