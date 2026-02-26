## Contributing to Bricks Backend

Thank you for your interest in contributing to **Bricks Backend**.  
This document describes how to propose changes, report issues, and submit pull requests in a clean and consistent way.

---

## 🧭 Ways to Contribute

- **Bug reports** – help us identify and document defects.
- **Feature requests** – propose improvements or new capabilities.
- **Code contributions** – fix bugs, add features, improve performance.
- **Documentation** – improve READMEs, guides, and comments where needed.

---

## 🐞 Reporting Bugs

When opening a bug report, please include:

- **Environment details**
  - OS, Node.js version, database / services involved.
- **Steps to reproduce**
  - A minimal, clear sequence of actions or API calls that triggers the bug.
- **Expected behavior**
  - What you thought should happen.
- **Actual behavior**
  - What actually happened (logs, error messages, stack traces if available).

If possible, provide:

- A **minimal reproducible example**.
- Relevant **logs or screenshots** (redacting any sensitive information).

---

## 💡 Suggesting Features

For feature or improvement requests, please describe:

- **Motivation / use case** – what problem this solves.
- **Proposed solution** – high-level behavior or API changes.
- **Alternatives considered** – if applicable.
- **Potential impact** – breaking changes, migrations, or compatibility notes.

This helps maintainers evaluate and prioritize work.

---

## 🔧 Development Workflow

1. **Fork** the repository (if contributing from outside the main org).
2. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feature/short-description
   ```

3. **Install dependencies**:

   ```bash
   npm install
   # or
   yarn install
   ```

4. **Set up environment variables** using `.env.example` or `.env.dev` as a reference.
5. **Implement your changes**, including:
   - Tests where appropriate.
   - Documentation updates (README, comments, or new docs).
6. **Run tests and linters** (if configured) and make sure they pass:

   ```bash
   npm test
   # plus any lint or format commands defined in package.json
   ```

7. **Commit your changes** with clear, concise messages.
8. **Push your branch** and open a **Pull Request (PR)** against `main`.

---

## ✅ Pull Request Guidelines

To help us review your PR efficiently:

- **Keep PRs focused** on a single change or small group of related changes.
- **Describe what and why** in the PR description:
  - What you changed.
  - Why this change is needed.
  - Any trade‑offs or follow‑ups.
- **Link issues** your PR addresses (e.g. `Fixes #123`).
- **Add tests** for new features and bug fixes whenever possible.
- **Avoid large, unrelated refactors** in the same PR.

Maintainers may ask for adjustments to keep the codebase consistent and maintainable.

---

## 🧪 Coding Standards

- **Style & formatting**
  - Follow the existing code style of nearby files.
  - Use configured linters/formatters (if present) rather than introducing new styles.
- **Types & safety**
  - Prefer strong typing (TypeScript) where applicable.
  - Validate and sanitize external input at the API boundaries.
- **Security**
  - Never commit secrets or credentials.
  - Be mindful of access control, rate limiting, and data privacy.

If the repository defines specific lint rules or formatting tools (e.g. ESLint, Prettier), please run them before committing.

---

## 🔐 License and Contributor Agreement

By contributing to this project, you agree that:

- Your contributions are licensed under the same license as the project:  
  **Apache License 2.0**.
- You have the right to submit the code and content you contribute.

See the `LICENSE` file for full legal details.

---

## 🙏 Thank You

Your time and effort in improving **Bricks Backend** are greatly appreciated.  
Together, we can build a robust, secure, and developer‑friendly platform that powers the Bricks ecosystem.

