import "regenerator-runtime/runtime";
import axios from "axios";
import fetchAdapter from "@vespaiach/axios-fetch-adapter";

/* Useful config properties
baseURL, timeout, params, headers, data,
xsrfCookieName, xsrfHeaderName, cancelToken, withCredentials
*/
const ax = axios.create({
  timeout: 1000,
  adapter: fetchAdapter
});

ax.interceptors.request.use(async (config) => {
  const { token } = await chrome.identity.getAuthToken({ interactive: true });
  if (config.headers) config.headers["Authorization"] = `Bearer ${token}`;
  else config.headers = { "Authorization": `Bearer ${token}` };
  return config;
}, (e) => {
  console.log("Request Error: ", e);
  return Promise.reject(e);
});

ax.interceptors.response.use((res) => {
  // Status 2xx
  return res;
}, (e) => {
  // Status not 2xx
  // Handle individual status codes, maybe clearing cookies/storage
  // If unauthorized, send another request for a refresh token
  console.log("Response Error: ", e);

  // switch (error.response?.status) {
  //   case 401:
  //     break;
  //   case 403:
  //     break;
  //   case 404:
  //     break;
  //   case 500:
  //     break;
  //   case 503:
  //     break;
  //   default:
  //     break;
  // }
  return Promise.reject(error);
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

export default ax;

