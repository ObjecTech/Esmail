# AI Mail Chat Design

## Goal

Turn the AI screen from a single-shot search box into a conversational mailbox assistant. The user can ask natural questions such as "summarize unread important mail" or "I remember seeing a coursework email" and receive a chat response plus cited email cards.

## Chosen Approach

Use the current backend LLM chat endpoint for natural answers and add a deterministic front-end citation matcher over the emails already loaded in the app. This gives the first version a model-like conversation while keeping source cards reliable and testable. The UI reserves a "continue searching more mail" action for a later backend history-search upgrade.

## User Experience

The AI screen becomes a conversation surface:

- New conversations start with a short assistant greeting and suggestion chips.
- Each user submit appends a user bubble instead of replacing the previous result.
- Each assistant response appends an assistant bubble.
- If local matching finds relevant emails, the assistant response shows up to three email reference cards.
- Clicking a card opens the email detail page.
- Clicking "expand snippet" reveals sender, date, summary bullets, and a matching body/snippet excerpt in the chat.
- If matching is weak or the user asks for older mail, a disabled/placeholder "continue searching more mail" affordance appears.

## Functional Requirements

1. Conversation state supports multiple messages in order.
2. Chat history stores and restores whole conversations, not just one prompt and one reply.
3. The AI screen receives loaded emails and an `onOpenEmail` callback from `App`.
4. Local email matching ranks loaded emails by text overlap, category/priority/date hints, and common mail-intent terms.
5. Citations include email id, sender, subject, date, category ids, summary bullets, snippet/body excerpt, and a match score.
6. Assistant requests still call the existing `onAskAssistant(prompt)` path, so backend fallback behavior remains intact.
7. Empty input does not create messages.
8. Starting a new conversation clears current messages and input but keeps saved history.
9. The "continue searching more mail" control is visible as a placeholder when fewer than three citations are found for a search-like request.

## Non-Goals

- Do not implement backend historical Gmail/QQ search in this iteration.
- Do not execute mailbox actions such as archive, delete, or create todo from chat.
- Do not replace the existing backend chat endpoint.
- Do not introduce a new AI provider or dependency.

## Components And Data Flow

`App.tsx` passes `allReadableEmails` and `handleOpenEmail` into `AiScreen`.

`AiScreen.tsx` owns conversation UI state:

- `messages`: current ordered chat messages.
- `history`: saved conversations in localStorage.
- `expandedCitationIds`: citation cards expanded inside the chat.
- `submit`: appends user message, gets assistant reply, runs local citation matching, then appends assistant message.

`ai.ts` provides pure helpers:

- `findRelevantEmailCitations(prompt, emails, language)` ranks loaded emails.
- `buildEmailCitation(email, prompt, score, language)` formats cards and excerpts.
- Existing `getAssistantReply` remains as fallback reply generation.

## Error Handling

If the backend assistant call fails, `App` already falls back to `getAssistantReply`. `AiScreen` should still append an assistant message from that fallback. If a citation references an email that later disappears, clicking it should do nothing because the callback receives the original email object from current props.

## Testing

Add tests for:

- Citation matching finds coursework-style mail by natural-language memory.
- Citation matching ranks important/deadline mail for summary prompts.
- `AiScreen` appends user and assistant bubbles instead of replacing the response.
- `AiScreen` renders citation cards and calls `onOpenEmail` when a card is opened.
- `AiScreen` expands a citation snippet in the chat.
- Existing history and voice-button tests continue to pass.

