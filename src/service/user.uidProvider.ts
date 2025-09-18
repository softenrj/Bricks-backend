import { uid } from "uid/secure";

export const userIdProvider = () => {
  return uid();
};