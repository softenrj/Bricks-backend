import { uid } from "uid/secure";

export const userIdProvider = () => {
  return uid();
};

export const uIdProvider = () => {
  return uid(16);
};