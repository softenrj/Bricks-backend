// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { uid } from "uid/secure";

export const userIdProvider = () => {
  return uid();
};

export const uIdProvider = () => {
  return uid(16);
};

export const processIdProvider = () => {
  return uid(36);
};
