# AI Mail Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a conversational AI mailbox screen with local email citation cards and expandable snippets.

**Architecture:** Keep the existing backend chat path for natural answers, and add deterministic local citation matching in `src/ai.ts`. `App.tsx` passes loaded emails and an open-email callback into `AiScreen.tsx`, which owns the chat timeline, saved conversations, and citation UI.

**Tech Stack:** React 18, TypeScript, lucide-react, Vitest, Testing Library, existing Vite app.

---

## File Structure

- Modify `src/types.ts`: add `EmailCitation`, `AiChatMessage`, and `AiConversation` types.
- Modify `src/ai.ts`: add pure citation-ranking helpers.
- Modify `src/components/AiScreen.tsx`: render a chat timeline, citation cards, expanded snippets, and saved conversations.
- Modify `src/App.tsx`: pass `allReadableEmails` and `handleOpenEmail` into `AiScreen`.
- Modify `src/styles.css`: style chat bubbles, citation cards, and placeholder search affordance.
- Modify `src/ai.test.ts`: cover citation matching behavior.
- Modify `src/components/AiScreen.test.tsx`: cover chat timeline and citation interactions.

### Task 1: Citation Matching Helpers

**Files:**
- Modify: `src/types.ts`
- Modify: `src/ai.ts`
- Test: `src/ai.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests asserting `findRelevantEmailCitations("我之前看到一封 coursework 的邮件", emails, "zh")` returns the coursework email first, and `findRelevantEmailCitations("总结今天未读的重要邮件", emails, "zh")` prioritizes high-priority/deadline emails.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/ai.test.ts`

Expected: FAIL because `findRelevantEmailCitations` is not exported.

- [ ] **Step 3: Implement minimal helper**

Add citation types and implement tokenization, query hint scoring, excerpt generation, and top-three ranking in `src/ai.ts`.

- [ ] **Step 4: Run green test**

Run: `npm test -- src/ai.test.ts`

Expected: PASS.

### Task 2: Conversational AiScreen State

**Files:**
- Modify: `src/components/AiScreen.tsx`
- Test: `src/components/AiScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

Update existing tests so submitting a prompt renders the user text as a chat message and the assistant response as a separate assistant message. Add an assertion that the old static `ai-reply` replacement behavior is gone.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/components/AiScreen.test.tsx`

Expected: FAIL because the current component only stores one `reply`.

- [ ] **Step 3: Implement message timeline**

Replace single `reply` rendering with ordered messages. Keep the greeting, suggestions, new conversation, history, and input behavior.

- [ ] **Step 4: Run green test**

Run: `npm test -- src/components/AiScreen.test.tsx`

Expected: PASS.

### Task 3: Citation Cards And Open Email

**Files:**
- Modify: `src/components/AiScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/components/AiScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that pass emails into `AiScreen`, submit a coursework prompt, see a citation card, click "打开邮件", and verify `onOpenEmail` receives the matched email. Add a test for "展开片段".

- [ ] **Step 2: Run red test**

Run: `npm test -- src/components/AiScreen.test.tsx`

Expected: FAIL because `AiScreen` does not accept emails or open callbacks.

- [ ] **Step 3: Implement citation UI**

Add `emails` and `onOpenEmail` props. Run `findRelevantEmailCitations` on submit. Render citation cards under assistant messages, including subject, sender, date, match label, open button, expand button, and expanded summary/excerpt.

- [ ] **Step 4: Wire App**

Pass `allReadableEmails` and `handleOpenEmail` from `App.tsx` into `AiScreen`.

- [ ] **Step 5: Run green test**

Run: `npm test -- src/components/AiScreen.test.tsx`

Expected: PASS.

### Task 4: Visual Styling And Placeholder Search

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/AiScreen.tsx`
- Test: `src/components/AiScreen.test.tsx`

- [ ] **Step 1: Write failing test**

Add a test that search-like prompts with fewer than three citations render `继续搜索更多邮件`.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/components/AiScreen.test.tsx`

Expected: FAIL because the placeholder is not rendered.

- [ ] **Step 3: Implement placeholder and styles**

Render placeholder for search-like prompts with low citation count. Add CSS for `.ai-chat-thread`, `.ai-message`, `.ai-citation-card`, `.ai-citation-expanded`, and `.ai-more-search`.

- [ ] **Step 4: Run green test**

Run: `npm test -- src/components/AiScreen.test.tsx`

Expected: PASS.

### Task 5: Full Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all test files pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: TypeScript and Vite build pass. Existing Vite chunking warnings may remain if unrelated.

- [ ] **Step 3: Browser smoke check**

Open `http://localhost:5174/`, navigate to AI, submit a memory-style prompt, verify the chat appends messages and citations are visible.

