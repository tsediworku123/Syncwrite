import axios from "axios";

// withCredentials lets the httpOnly auth cookie flow with every request,
// so the app never needs to store the JWT in JS-accessible storage.
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});
