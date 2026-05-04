import { useCallback, useEffect, useMemo, useState } from "react";
import { analyzeInbox, askAssistant, createDraft, getEmailMessage, getGmailMessages, getSession, loginQqMailbox, logoutGoogle, sendEmail, updateGmailMessage } from "./api";
import { AppShell } from "./components/AppShell";
import { AiScreen } from "./components/AiScreen";
import { ComposeScreen } from "./components/ComposeScreen";
import { EmailDetailScreen } from "./components/EmailDetailScreen";
import { InboxScreen } from "./components/InboxScreen";
import { LoginScreen } from "./components/LoginScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { SideMenu } from "./components/SideMenu";
import { TodosScreen } from "./components/TodosScreen";
import { applyCustomViewFilters, defaultCustomViewSettings, visibleCategoriesForView } from "./customView";
import { defaultCategories, initialRules } from "./mockData";
import { computeMailboxCounts, computeUnreadInboxCount, mailboxItemsForView } from "./mailboxCounts";
import { applySortRules, emailCategoryIds } from "./rules";
import { activeTodos, completeTodo, createInitialTodos, createSuggestedTodo, createTodoFromEmail } from "./todos";
import type { AccountSession, Category, CustomViewSettings, Draft, Email, InboxAnalysis, Language, MailboxView, Screen, SettingsMode, SortRule, Theme, Todo } from "./types";

const themeCycle: Theme[] = ["classic", "white"];

function nextTheme(theme: Theme) {
  return themeCycle[(themeCycle.indexOf(theme) + 1) % themeCycle.length];
}

function initialTheme(): Theme {
  const stored = window.localStorage.getItem("esmail.theme");
  return themeCycle.includes(stored as Theme) ? (stored as Theme) : "classic";
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>("inbox");
  const [mailboxView, setMailboxView] = useState<MailboxView>("inbox");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [customViewSettings, setCustomViewSettings] = useState<CustomViewSettings>(() => defaultCustomViewSettings(defaultCategories));
  const [rules, setRules] = useState<SortRule[]>(initialRules);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTodoEditing, setIsTodoEditing] = useState(false);
  const [language, setLanguage] = useState<Language>("zh");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [settingsMode, setSettingsMode] = useState<SettingsMode>("customView");
  const [session, setSession] = useState<AccountSession>({ authenticated: false });
  const [sessionStatus, setSessionStatus] = useState<"loading" | "ready">("loading");
  const [showLogin, setShowLogin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localEmails, setLocalEmails] = useState<Email[]>([]);
  const [gmailEmails, setGmailEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [gmailStatus, setGmailStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [gmailError, setGmailError] = useState("");
  const [detailNotice, setDetailNotice] = useState("");

  const sourceEmails = session.authenticated ? gmailEmails : localEmails;
  const mailboxCounts = useMemo(() => computeMailboxCounts(sourceEmails, sentEmails), [sentEmails, sourceEmails]);
  const mailboxSourceEmails = useMemo(() => mailboxItemsForView(mailboxView, sourceEmails, sentEmails), [mailboxView, sentEmails, sourceEmails]);
  const inboxCount = useMemo(() => computeUnreadInboxCount(sourceEmails), [sourceEmails]);
  const showCategoryTabs = mailboxView === "inbox";
  const visibleCategories = useMemo(
    () => visibleCategoriesForView(categories, customViewSettings.visibleCategoryIds),
    [categories, customViewSettings.visibleCategoryIds]
  );
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const inboxEmails = mailboxItemsForView("inbox", sourceEmails, sentEmails);
    for (const email of applySortRules(inboxEmails, categories, rules)) {
      for (const categoryId of emailCategoryIds(email)) {
        counts[categoryId] = (counts[categoryId] || 0) + 1;
      }
    }
    return counts;
  }, [categories, rules, sentEmails, sourceEmails]);
  const sortedEmails = useMemo(() => {
    const classified = applySortRules(mailboxSourceEmails, categories, rules);
    if (mailboxView !== "inbox") return classified;
    return applyCustomViewFilters(classified, customViewSettings, session.email || "");
  }, [mailboxSourceEmails, categories, customViewSettings, mailboxView, rules, session.email]);
  const emails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedEmails;
    return sortedEmails.filter((email) =>
      [
        email.senderName,
        email.senderEmail,
        email.subject,
        email.snippet,
        email.body,
        email.dateLabel,
        email.categoryId,
        email.fallbackCategoryId,
        ...(email.categoryIds || []),
        ...(email.fallbackCategoryIds || [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [searchQuery, sortedEmails]);
  const allReadableEmails = useMemo(() => applySortRules(sourceEmails, categories, rules), [categories, rules, sourceEmails]);
  const openTodos = activeTodos(todos);
  const selectedEmail = useMemo(
    () => applySortRules(sourceEmails, categories, rules).find((email) => email.id === selectedEmailId) || null,
    [categories, rules, selectedEmailId, sourceEmails]
  );

  useEffect(() => {
    if (activeCategoryId !== "all" && !customViewSettings.visibleCategoryIds.includes(activeCategoryId)) {
      setActiveCategoryId("all");
    }
  }, [activeCategoryId, customViewSettings.visibleCategoryIds]);

  useEffect(() => {
    window.localStorage.setItem("esmail.theme", theme);
  }, [theme]);

  function authErrorMessage(code: string | null, detail: string | null) {
    if (code === "google_network_timeout") {
      return language === "zh"
        ? "授权已返回，但本机后端连接 Google token 服务超时。请检查网络、VPN 或代理后重试。"
        : "Google approved the request, but the local backend timed out while contacting Google's token service. Check network, VPN, or proxy settings and try again.";
    }
    if (code) {
      return language === "zh" ? `Google 授权没有完成：${detail || code}` : `Google sign-in did not finish: ${detail || code}`;
    }
    return "";
  }

  function mergeAnalysis(items: Email[], analysis: InboxAnalysis[]) {
    return items.map((email) => {
      const result = analysis.find((item) => item.id === email.id);
      if (!result) return email;
      return {
        ...email,
        fallbackCategoryIds: result.categoryIds?.length ? result.categoryIds : email.fallbackCategoryIds,
        fallbackCategoryId: result.categoryId || result.categoryIds?.[0] || email.fallbackCategoryId,
        categoryIds: result.categoryIds?.length ? result.categoryIds : email.categoryIds,
        categoryId: result.categoryId || result.categoryIds?.[0] || email.categoryId,
        summaryBullets: result.summaryBullets?.length ? result.summaryBullets.slice(0, 3) : email.summaryBullets,
        aiAction: result.todoTitle
          ? {
              mode: "automatic" as const,
              title: result.todoTitle
            }
          : email.aiAction
      };
    });
  }

  const loadGmail = useCallback(async () => {
    setGmailStatus("loading");
    setGmailError("");
    try {
      const freshEmails = await getGmailMessages();
      const analysis = await analyzeInbox(freshEmails);
      const enhancedEmails = mergeAnalysis(freshEmails, analysis);
      setGmailEmails(enhancedEmails);
      setTodos(createInitialTodos(enhancedEmails));
      setGmailStatus("loaded");
    } catch (error) {
      setGmailStatus("error");
      setGmailError(error instanceof Error ? error.message : language === "zh" ? "邮箱加载失败" : "Mailbox load failed");
    }
  }, [language]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const authError = params.get("auth_error");
    const authDetail = params.get("auth_detail");

    if (connected || authError) {
      setActiveScreen("inbox");
      setShowLogin(false);
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (authError) {
      setGmailStatus("error");
      setGmailError(authErrorMessage(authError, authDetail));
    }

    getSession()
      .then((nextSession) => {
        setSession(nextSession);
        if (nextSession.authenticated) {
          void loadGmail();
        } else if (connected && !authError) {
          setGmailStatus("error");
          setGmailError(language === "zh" ? "Google 登录回调完成，但没有保存到本地会话。请重新连接。" : "Google returned to Esmail, but no local session was saved. Please reconnect.");
        }
        setSessionStatus("ready");
      })
      .catch(() => {
        setSession({ authenticated: false });
        setSessionStatus("ready");
      });
  }, [loadGmail]);

  function addCategory(category: Category) {
    setCategories((current) => [...current, category]);
    setCustomViewSettings((current) => ({
      ...current,
      visibleCategoryIds: [...current.visibleCategoryIds, category.id]
    }));
    setActiveCategoryId(category.id);
  }

  function addRule(rule: SortRule) {
    setRules((current) => [...current, rule]);
  }

  function deleteRule(ruleId: string) {
    setRules((current) => current.filter((rule) => rule.id !== ruleId));
  }

  function addSuggestedTodo(email: Email) {
    const todo = createSuggestedTodo(email);
    if (!todo) return;
    setTodos((current) => (current.some((item) => item.id === todo.id) ? current : [...current, todo]));
  }

  function addTodoFromEmail(email: Email) {
    const todo = createTodoFromEmail(email);
    setTodos((current) => (current.some((item) => item.id === todo.id) ? current : [...current, todo]));
  }

  function handleCompleteTodo(todoId: string) {
    setTodos((current) => completeTodo(current, todoId));
  }

  function mergeEmailDetail(email: Email, detail: Email) {
    return {
      ...email,
      ...detail,
      categoryIds: detail.categoryIds?.length ? detail.categoryIds : email.categoryIds,
      fallbackCategoryIds: detail.fallbackCategoryIds?.length ? detail.fallbackCategoryIds : email.fallbackCategoryIds,
      categoryId: detail.categoryId || email.categoryId,
      fallbackCategoryId: detail.fallbackCategoryId || email.fallbackCategoryId,
      summaryBullets: detail.summaryBullets?.length ? detail.summaryBullets : email.summaryBullets,
      fullLoaded: true
    };
  }

  function handleOpenEmail(email: Email) {
    setDetailNotice("");
    setSelectedEmailId(email.id);
    const shouldMarkRead = email.unread !== false;
    if (shouldMarkRead) {
      patchEmail(email.id, { unread: false });
      void syncGmailAction(email, "markRead");
    }
    if (email.id.startsWith("sent-") || email.fullLoaded) return;
    setDetailNotice(language === "zh" ? "正在加载完整邮件内容..." : "Loading full message...");
    getEmailMessage(email.id)
      .then((detail) => {
        patchEmail(email.id, { ...mergeEmailDetail(email, detail), unread: false });
        setDetailNotice("");
      })
      .catch((error) => {
        setDetailNotice(error instanceof Error ? error.message : language === "zh" ? "完整邮件加载失败" : "Failed to load full message");
      });
  }

  function handleBackToInbox() {
    setSelectedEmailId(null);
  }

  function completeAllActiveTodos() {
    setTodos((current) => current.map((todo) => (todo.status === "active" ? { ...todo, status: "completed" } : todo)));
  }

  function completeTodos(todoIds: string[]) {
    setTodos((current) => current.map((todo) => (todoIds.includes(todo.id) ? { ...todo, status: "completed" } : todo)));
  }

  function deleteTodos(todoIds: string[]) {
    setTodos((current) => current.filter((todo) => !todoIds.includes(todo.id)));
  }

  function mailboxTitle(view: MailboxView) {
    const labels: Record<MailboxView, string> = {
      inbox: language === "zh" ? "收件箱" : "Inbox",
      all: textLabel("所有邮件", "All Mail"),
      starred: textLabel("已加星标", "Starred"),
      snoozed: textLabel("已延后", "Snoozed"),
      drafts: textLabel("草稿", "Drafts"),
      sent: textLabel("已发送", "Sent"),
      archive: textLabel("归档", "Archive"),
      spam: textLabel("垃圾邮件", "Spam"),
      trash: textLabel("回收站", "Trash")
    };
    return labels[view];
  }

  function textLabel(zh: string, en: string) {
    return language === "zh" ? zh : en;
  }

  function connectGoogle() {
    window.location.href = "/api/auth/google";
  }

  async function handleQqLogin(payload: Parameters<typeof loginQqMailbox>[0]) {
    setGmailStatus("loading");
    setGmailError("");
    try {
      const result = await loginQqMailbox(payload);
      setSession(result.session);
      await loadGmail();
      setShowLogin(false);
    } catch (error) {
      setGmailStatus("error");
      const message = error instanceof Error ? error.message : language === "zh" ? "QQ 邮箱登录失败" : "QQ Mail sign-in failed";
      setGmailError(message);
      throw error;
    }
  }

  async function handleLogout() {
    await logoutGoogle();
    setSession({ authenticated: false });
    setGmailEmails([]);
    setLocalEmails([]);
    setTodos([]);
    setGmailStatus("idle");
  }

  async function handleAskAssistant(prompt: string) {
    try {
      return await askAssistant(prompt, language, allReadableEmails.slice(0, 30));
    } catch {
      const { getAssistantReply } = await import("./ai");
      return getAssistantReply(prompt, language, allReadableEmails);
    }
  }

  async function handleCreateDraft(idea: string, draftLanguage: string, tone: string): Promise<Draft> {
    try {
      return await createDraft(idea, draftLanguage === "English" ? "en" : "zh", tone);
    } catch {
      const { generateDraft } = await import("./ai");
      return generateDraft(idea, draftLanguage, tone);
    }
  }

  async function handleSendEmail(payload: { to: string; subject: string; body: string }) {
    await sendEmail(payload);
    const sentEmail: Email = {
      id: `sent-${Date.now()}`,
      senderName: language === "zh" ? "我" : "Me",
      senderEmail: session.email || "me",
      to: payload.to,
      subject: payload.subject,
      snippet: payload.body.replace(/\s+/g, " ").slice(0, 120),
      body: payload.body,
      dateLabel: language === "zh" ? "刚刚" : "Now",
      fallbackCategoryId: "others",
      fallbackCategoryIds: ["others"],
      categoryId: "others",
      categoryIds: ["others"],
      priority: "medium",
      summaryBullets: [payload.body.replace(/\s+/g, " ").slice(0, 90)],
      sent: true
    };
    setSentEmails((current) => [sentEmail, ...current]);
    setMailboxView("sent");
    setActiveScreen("inbox");
    setIsComposeOpen(false);
  }

  function patchEmail(emailId: string, patch: Partial<Email>) {
    const updater = (items: Email[]) => items.map((email) => (email.id === emailId ? { ...email, ...patch } : email));
    if (gmailEmails.length) {
      setGmailEmails(updater);
    } else {
      setLocalEmails(updater);
    }
  }

  async function syncGmailAction(email: Email, action: string) {
    if (!gmailEmails.length || !session.authenticated || session.provider !== "google") return true;
    try {
      await updateGmailMessage(email.id, action);
      return true;
    } catch (error) {
      setDetailNotice(
        language === "zh"
          ? "本地已更新。若 Gmail 没同步，请重新连接 Google 邮箱并授权 Gmail 修改权限。"
          : "Updated locally. If Gmail did not sync, reconnect Google Mail and grant Gmail modify access."
      );
      console.warn(error);
      return false;
    }
  }

  async function handleEmailAction(email: Email, action: "toggleStar" | "archive" | "delete" | "markUnread" | "markNotImportant" | "snooze" | "createTodo" | "filterSender" | "print") {
    if (action === "toggleStar") {
      const nextStarred = !email.starred;
      patchEmail(email.id, { starred: nextStarred });
      setDetailNotice(language === "zh" ? (nextStarred ? "已收藏" : "已取消收藏") : (nextStarred ? "Starred" : "Unstarred"));
      await syncGmailAction(email, nextStarred ? "star" : "unstar");
      return;
    }

    if (action === "archive") {
      patchEmail(email.id, { archived: true });
      if (!(await syncGmailAction(email, "archive"))) return;
      setSelectedEmailId(null);
      return;
    }

    if (action === "delete") {
      patchEmail(email.id, { deleted: true });
      setTodos((current) => current.filter((todo) => todo.emailId !== email.id));
      if (!(await syncGmailAction(email, "delete"))) return;
      setSelectedEmailId(null);
      return;
    }

    if (action === "markUnread") {
      patchEmail(email.id, { unread: true });
      setDetailNotice(language === "zh" ? "已设为未读" : "Marked unread");
      await syncGmailAction(email, "markUnread");
      return;
    }

    if (action === "markNotImportant") {
      patchEmail(email.id, { fallbackCategoryId: "others", fallbackCategoryIds: ["others"], categoryId: "others", categoryIds: ["others"], priority: "medium" });
      setDetailNotice(language === "zh" ? "已标记为不重要" : "Marked not important");
      await syncGmailAction(email, "markNotImportant");
      return;
    }

    if (action === "snooze") {
      patchEmail(email.id, { archived: true, snoozed: true });
      setSelectedEmailId(null);
      return;
    }

    if (action === "createTodo") {
      addTodoFromEmail(email);
      setDetailNotice(language === "zh" ? "已创建待办" : "Todo created");
      return;
    }

    if (action === "filterSender") {
      const domain = email.senderEmail.split("@")[1] || email.senderEmail;
      addRule({
        id: `rule-${email.id}-${Date.now()}`,
        categoryId: email.categoryId || email.categoryIds?.[0] || email.fallbackCategoryId,
        field: "domain",
        operator: "contains",
        value: domain,
        enabled: true
      });
      setDetailNotice(language === "zh" ? `已添加 ${domain} 的分类规则` : `Rule added for ${domain}`);
      return;
    }

    window.print();
  }

  if (sessionStatus === "loading" || showLogin || !session.authenticated) {
    return (
      <LoginScreen
        error={gmailError}
        language={language}
        loading={sessionStatus === "loading"}
        onGoogleLogin={connectGoogle}
        onQqLogin={handleQqLogin}
        onToggleLanguage={() => setLanguage((current) => (current === "zh" ? "en" : "zh"))}
      />
    );
  }

  return (
    <AppShell
      activeScreen={activeScreen}
      activeTodoCount={openTodos.length}
      inboxCount={inboxCount}
      hideNavigation={isComposeOpen || Boolean(selectedEmail) || activeScreen === "settings" || isTodoEditing}
      language={language}
      theme={theme}
      onCompose={() => setIsComposeOpen(true)}
      onNavigate={setActiveScreen}
    >
      <SideMenu
        categories={categories}
        categoryCounts={categoryCounts}
        inboxCount={inboxCount}
        isOpen={isMenuOpen}
        language={language}
        mailboxCounts={mailboxCounts}
        mailboxView={mailboxView}
        theme={theme}
        onCategorySelect={(categoryId) => {
          setActiveCategoryId(categoryId);
          setMailboxView("inbox");
          setActiveScreen("inbox");
        }}
        onClose={() => setIsMenuOpen(false)}
        onMailboxSelect={(view) => {
          setMailboxView(view);
          setActiveScreen("inbox");
        }}
        onOpenSettings={() => {
          setSettingsMode("customView");
          setActiveScreen("settings");
        }}
        onOpenSmartLabel={() => {
          setSettingsMode("smartLabel");
          setActiveScreen("settings");
        }}
        onToggleLanguage={() => setLanguage((current) => (current === "zh" ? "en" : "zh"))}
        onToggleTheme={() => setTheme(nextTheme)}
      />
      {isComposeOpen ? (
        <ComposeScreen
          accountEmail={session.email || "qingnei0@gmail.com"}
          canSend={session.authenticated}
          language={language}
          onClose={() => setIsComposeOpen(false)}
          onGenerateDraft={handleCreateDraft}
          onSendEmail={handleSendEmail}
        />
      ) : selectedEmail ? (
        <EmailDetailScreen
          email={selectedEmail}
          isTodoCompleted={todos.some((todo) => todo.emailId === selectedEmail.id && todo.status === "completed")}
          language={language}
          notice={detailNotice}
          onAddSuggestedTodo={addSuggestedTodo}
          onAction={handleEmailAction}
          onBack={handleBackToInbox}
          onCompleteTodo={handleCompleteTodo}
          todo={todos.find((todo) => todo.emailId === selectedEmail.id)}
        />
      ) : activeScreen === "inbox" ? (
        <InboxScreen
          activeCategoryId={activeCategoryId}
          categories={visibleCategories}
          emails={emails}
          gmailError={gmailError}
          gmailStatus={gmailStatus}
          language={language}
          mailboxTitle={mailboxTitle(mailboxView)}
          searchQuery={searchQuery}
          session={session}
          onAddAccount={() => setShowLogin(true)}
          onConnectGoogle={() => {
            if (session.provider === "qq") {
              void loadGmail();
              return;
            }
            connectGoogle();
          }}
          onLogoutAccount={handleLogout}
          onCategoryChange={setActiveCategoryId}
          onOpenEmail={handleOpenEmail}
          onOpenMenu={() => setIsMenuOpen(true)}
          onOpenSettings={() => {
            setSettingsMode("customView");
            setActiveScreen("settings");
          }}
          onSearchChange={setSearchQuery}
          showCategories={showCategoryTabs}
          todos={todos}
        />
      ) : activeScreen === "todos" ? (
        <TodosScreen
          editMode={isTodoEditing}
          emails={emails}
          language={language}
          onCompleteAll={completeAllActiveTodos}
          onCompleteTodo={handleCompleteTodo}
          onCompleteTodos={completeTodos}
          onDeleteTodos={deleteTodos}
          onEditModeChange={setIsTodoEditing}
          onOpenEmail={handleOpenEmail}
          todos={todos}
        />
      ) : activeScreen === "ai" ? (
        <AiScreen emails={allReadableEmails} language={language} onAskAssistant={handleAskAssistant} onOpenEmail={handleOpenEmail} />
      ) : (
        <SettingsScreen
          categories={categories}
          language={language}
          mode={settingsMode}
          onAddCategory={addCategory}
          onAddRule={addRule}
          onBack={() => setActiveScreen("inbox")}
          onDeleteRule={deleteRule}
          onViewSettingsChange={setCustomViewSettings}
          rules={rules}
          viewSettings={customViewSettings}
        />
      )}
    </AppShell>
  );
}
