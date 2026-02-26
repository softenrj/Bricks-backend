## 🚀 Bricks Backend

**Bricks Backend** is the secure, cloud-ready service layer that powers **[Bricks AI](https://github.com/softenrj/Bricks)** – an AI-powered IDE that transforms ideas into functional applications directly in your browser.

This repository contains the backend services that handle:

- **Project & workspace orchestration**
- **AI code generation and execution pipelines**
- **Authentication, authorization & user/session management**
- **Realtime collaboration & messaging** _(in active development)_
- **Secure communication with the browser-based IDE**

> **Feature status**  
> - **Voice** and **image-based** interactions are **under active development** and not yet considered production-ready.  
> - **Realtime collaboration** capabilities exposed by this backend are also **evolving** and may be experimental or incomplete depending on your deployment.

> **Note**  
> The public Bricks frontend lives at **[`softenrj/Bricks`](https://github.com/softenrj/Bricks)**.  
> This repository provides the backend APIs consumed by that UI.

---

## ✨ High‑Level Overview

- **Domain**: Backend for the Bricks AI IDE and project workspace
- **Role**: Acts as the single source of truth for projects, sessions, files, and AI operations
- **Clients**:  
  - Bricks web IDE (`https://bricks-three-rose.vercel.app`)  
  - Internal services / automations  
- **Focus**: Reliability, security, observability, and performance under AI-heavy workloads

At a high level, Bricks Backend is responsible for:

- **Orchestrating AI requests** (code generation, refactors, explanations, etc.)
- **Managing project state** (files, versions, snapshots, metadata)
- **Coordinating real-time collaboration & events** _(designed, with some features in development)_
- **Enforcing access control and limits**

---

## 🧱 Core Responsibilities

- **Project Management**
  - Create, read, update, delete projects and workspaces
  - Maintain metadata for files, tabs, and editor state
- **AI Operations**
  - Handle prompts from the Bricks IDE (text in production; voice and image metadata in development)
  - Route and track model requests and responses
  - Persist relevant context for future interactions
- **Execution & Preview**
  - Manage build / run tasks sent from the browser
  - Stream logs and results back to the client
- **Collaboration**
  - Session presence & document events _(in development)_
  - Notifications for changes, builds, and AI actions
- **Security**
  - User auth & session validation
  - Rate limiting and abuse protection

---

## 🏗️ Architecture (Conceptual)

Bricks Backend is designed around a **modular, service-oriented architecture**:

- **API Layer**
  - Exposes REST/JSON (and optionally WebSocket) endpoints
  - Handles auth, validation, and request shaping
- **Domain / Application Layer**
  - Encodes all business rules (projects, sessions, AI workflows)
  - Orchestrates calls to models, storage, and queues
- **Infrastructure Layer**
  - Database & cache integration
  - Queueing / background jobs
  - Logging, metrics, and tracing

This separation keeps:

- **Domain logic** independent from frameworks
- **Integrations** (DB, model providers, queues) swappable
- **Scaling** straightforward when traffic grows

---

## 🔌 API Surface (Typical Patterns)

> **Important**: Exact endpoints and payloads may differ from this description if your local implementation has evolved. Use this section as a conceptual guide.

- **Auth & Users**
  - `POST /auth/login`
  - `POST /auth/logout`
  - `GET /me`
- **Projects**
  - `GET /projects`
  - `POST /projects`
  - `GET /projects/:id`
  - `PATCH /projects/:id`
  - `DELETE /projects/:id`
- **Files**
  - `GET /projects/:id/files`
  - `PUT /projects/:id/files/:path`
  - `DELETE /projects/:id/files/:path`
- **AI / Chat / Actions**
  - `POST /projects/:id/ai/chat`
  - `POST /projects/:id/ai/generate`
  - `POST /projects/:id/ai/refactor`
- **Execution**
  - `POST /projects/:id/run`
  - `GET /projects/:id/logs`

Wherever possible:

- Requests are **JSON**.
- Responses are **JSON**, with consistent shapes for `data`, `error`, and `meta`.

---

## ⚙️ Local Development

### 1. Prerequisites

- **Node.js** (LTS recommended)
- **npm** or **yarn** (depending on your project setup)
- Access to any required **API keys**, **database instances**, or **model providers**

### 2. Installation

In the repository root:

```bash
npm install
# or
yarn install
```

### 3. Environment Variables

Create a `.env` (or `.env.local`) file based on the template (if present), and fill in required values:

- **Authentication**
  - `JWT_SECRET` or relevant key
  - Provider secrets (e.g., OAuth, Firebase, etc.)
- **Database / Storage**
  - `DATABASE_URL`
  - `REDIS_URL` or cache connection
- **AI / Model Providers**
  - `OPENAI_API_KEY` or equivalent
  - Any other provider keys
- **Bricks Frontend Integration**
  - `BRICKS_FRONTEND_URL` (e.g. `https://bricks-three-rose.vercel.app`)

> **Security reminder**: Never commit `.env` files or secrets to version control.

### 4. Running the Server

```bash
npm run dev
# or
yarn dev
```

By default, the API will be available on something like:

- `http://localhost:PORT` (consult your `package.json` / config for the exact port)

### 5. Running Tests (If Configured)

```bash
npm test
# or
yarn test
```

---

## 🔐 Security & Best Practices

- **Secrets Management**
  - Use environment variables for all secrets.
  - Prefer a secrets manager in production (e.g. Vault, cloud provider services).
- **Auth & Sessions**
  - Validate tokens on every request.
  - Avoid storing sensitive data in JWT payloads.
- **Input Validation**
  - Validate request bodies, query params, and headers.
  - Enforce strict types between frontend and backend.
- **Rate Limiting**
  - Apply per-IP and per-user limits for sensitive / AI-heavy endpoints.
  - Protect login, AI actions, and project write operations.

---

## 🧩 Relation to Bricks Frontend

This backend is designed to be consumed by the **Bricks** web IDE:

- Frontend repository: **[`softenrj/Bricks`](https://github.com/softenrj/Bricks)**
- Production app: `https://bricks-three-rose.vercel.app`

Typical frontend → backend flows:

- User signs in → frontend obtains auth token → calls backend APIs
- User creates or opens a project → backend returns project structure & metadata
- User interacts with AI (chat, refactor, generate) → backend orchestrates model calls
- User runs the project → backend triggers build/run, streams logs and results

---

## 🧪 Environments

Typical environment layout (may vary by deployment):

- **Local** – developer machines
- **Staging** – for pre-production testing
- **Production** – live traffic from Bricks users

Suggested practices:

- Use separate databases and credentials per environment.
- Enable more verbose logging in non-production environments.
- Keep schema migrations automated and version-controlled.

---

## 🤝 Contributing

If you are working on Bricks Backend internally or in a trusted environment:

- **Open an issue** (or internal task) before large changes.
- **Discuss architecture** for significant features or refactors.
- **Keep documentation up-to-date** when introducing new APIs or breaking changes.

For the public Bricks frontend, see the contribution guidelines in **[`softenrj/Bricks`](https://github.com/softenrj/Bricks)**.

---

## 📄 License

This project is licensed under the **Apache License 2.0**.

- **Commercial use**: allowed under the terms of the license.
- **Modification & redistribution**: permitted, provided you comply with the license conditions.
- **Patent rights**: explicitly granted as described in Section 3 of the license.

See the full license text in the `LICENSE` file or online at **[Apache License 2.0][Apache-2.0]**.

---

## 🧭 Roadmap (Conceptual)

Planned or potential enhancements:

- **Richer AI workflows**
  - Multi-step agents and workflows orchestrated server-side
  - Deeper context windows and project-wide awareness
- **Enhanced Observability**
  - Detailed traces for AI calls and project events
  - Dashboards for performance and error rates
- **Advanced Collaboration**
  - Presence, cursors, comments, and review workflows
  - Time-travel and replay of project history

---

## 💬 Support & Contact

For general information about Bricks, visit the main repo:

- **Bricks Frontend & Project Overview**: **[`softenrj/Bricks`](https://github.com/softenrj/Bricks)**

For internal teams, follow your usual channels (Slack/Teams/email) to reach the maintainers of this backend.

---

## ❤️ Acknowledgements

Bricks Backend is part of the broader **Bricks AI** vision:  
**Transform ideas → code — instantly**, with a beautiful, collaborative, AI-native developer experience.

[Apache-2.0]: https://www.apache.org/licenses/LICENSE-2.0

