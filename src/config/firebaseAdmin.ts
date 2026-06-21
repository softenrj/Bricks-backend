// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import admin, { ServiceAccount } from "firebase-admin";
import { FIREBASE_SERVICE_ACCOUNT_CONFIG } from "./firebaseConfig.js";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT_CONFIG as ServiceAccount),
  });
}

export default admin;
