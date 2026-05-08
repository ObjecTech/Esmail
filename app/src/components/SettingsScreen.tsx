import { Check, ChevronDown, ChevronLeft, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { categoryLabel, text } from "../language";
import type { Category, CustomViewDateFilter, CustomViewFilterKey, CustomViewSettings, Language, RuleField, SettingsMode, SortRule } from "../types";
import { IconButton } from "./IconButton";

interface SettingsScreenProps {
  categories: Category[];
  language: Language;
  mode: SettingsMode;
  rules: SortRule[];
  viewSettings: CustomViewSettings;
  onAddCategory: (category: Category) => void;
  onAddRule: (rule: SortRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onViewSettingsChange: (settings: CustomViewSettings) => void;
  onBack: () => void;
}

const colors = ["#4ab3ff", "#7bd300", "#ffb21a", "#ef4d73", "#7f807e", "#7b6cf6", "#c838d8"];
const filterKeys = ["unread", "sentToMe", "ccMe", "attachments"] as const;

export function SettingsScreen({
  categories,
  language,
  mode,
  rules,
  viewSettings,
  onAddCategory,
  onAddRule,
  onDeleteRule,
  onViewSettingsChange,
  onBack
}: SettingsScreenProps) {
  const [label, setLabel] = useState("");
  const [hint, setHint] = useState("");
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [field, setField] = useState<RuleField>("domain");
  const [value, setValue] = useState("SCC");
  const [targetCategoryId, setTargetCategoryId] = useState(categories[0]?.id || "others");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.order - b.order), [categories]);
  const dateOptions = useMemo(
    () => [
      { id: "all" as const, label: language === "zh" ? "所有日期" : "All dates" },
      { id: "today" as const, label: language === "zh" ? "今天" : "Today" },
      { id: "sevenDays" as const, label: language === "zh" ? "最近 7 天" : "Last 7 days" },
      { id: "thirtyDays" as const, label: language === "zh" ? "最近 30 天" : "Last 30 days" }
    ],
    [language]
  );
  const selectedDateLabel = dateOptions.find((option) => option.id === viewSettings.dateFilter)?.label || dateOptions[0].label;

  function createCategory() {
    const cleanLabel = label.trim();
    if (!cleanLabel) return;
    const id = cleanLabel.toLowerCase().replace(/\s+/g, "-") + `-${categories.length}`;
    const category: Category = {
      id,
      label: cleanLabel,
      isDefault: false,
      color: selectedColor,
      order: categories.length
    };
    onAddCategory(category);
    setTargetCategoryId(id);
    setLabel("");
  }

  function toggleVisible(categoryId: string) {
    const visibleCategoryIds = viewSettings.visibleCategoryIds.includes(categoryId)
      ? viewSettings.visibleCategoryIds.filter((id) => id !== categoryId)
      : [...viewSettings.visibleCategoryIds, categoryId];
    onViewSettingsChange({ ...viewSettings, visibleCategoryIds });
  }

  function toggleFilter(filter: CustomViewFilterKey) {
    const activeFilters = viewSettings.activeFilters.includes(filter)
      ? viewSettings.activeFilters.filter((item) => item !== filter)
      : [...viewSettings.activeFilters, filter];
    onViewSettingsChange({ ...viewSettings, activeFilters });
  }

  function changeDateFilter(dateFilter: CustomViewDateFilter) {
    onViewSettingsChange({ ...viewSettings, dateFilter });
  }

  function createRule() {
    const cleanValue = value.trim();
    if (!cleanValue) return;
    onAddRule({
      id: `rule-${Date.now()}`,
      categoryId: targetCategoryId,
      field,
      operator: "contains",
      value: cleanValue,
      enabled: true
    });
  }

  if (mode === "smartLabel") {
    return (
      <section className="screen-section settings-screen smart-label-screen">
        <header className="custom-view-header smart-label-header">
          <IconButton label={language === "zh" ? "返回" : "Back"} onClick={onBack}>
            <ChevronLeft size={29} />
          </IconButton>
          <h1>{language === "zh" ? "创建智能标签" : "Create Smart Label"}</h1>
          <span />
        </header>

        <div className="smart-label-form">
          <div className="smart-form-head">
            <strong>{text(language, "name")}</strong>
            <span>{label.length}/30</span>
          </div>
          <input
            maxLength={30}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={language === "zh" ? "输入你喜欢的标签名称" : "Enter a label name"}
            value={label}
          />

          <div className="smart-form-head">
            <strong>{language === "zh" ? "标签提示词" : "Label prompt"}</strong>
            <span>{hint.length}/100</span>
          </div>
          <textarea
            maxLength={100}
            onChange={(event) => setHint(event.target.value)}
            placeholder={
              language === "zh"
                ? "详细描述哪些邮件符合此标签，以帮助 Esmail AI 更智能地工作。"
                : "Describe which emails belong here so Esmail AI can classify them."
            }
            value={hint}
          />

          <div className="smart-form-head color-title">
            <strong>{language === "zh" ? "颜色" : "Color"}</strong>
          </div>
          <div className="color-picker-row large-color-row">
            {colors.map((color) => (
              <button
                className="color-dot color-dot-button"
                key={color}
                onClick={() => setSelectedColor(color)}
                style={{ "--chip-color": color } as CSSProperties}
                type="button"
              >
                {selectedColor === color ? <Check size={25} strokeWidth={3} /> : null}
              </button>
            ))}
          </div>

          <button className="apply-checkbox smart-apply" type="button">
            <span className="square-check square-check-on"><Check size={18} strokeWidth={3} /></span>
            <span>{text(language, "applyRecent")}</span>
          </button>

          <button className="primary-wide smart-create-button" onClick={createCategory} type="button">
            {language === "zh" ? "创建并让 AI 辅助分类" : "Create and classify with AI"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen-section settings-screen">
      <header className="custom-view-header">
        <IconButton label={language === "zh" ? "返回" : "Back"} onClick={onBack}>
          <ChevronLeft size={29} />
        </IconButton>
        <h1>{text(language, "customView")}</h1>
        <button className="big-confirm" onClick={onBack} type="button" aria-label={language === "zh" ? "保存自定义视图" : "Save custom view"}>
          <Check size={31} strokeWidth={3} />
        </button>
      </header>

      <div className="custom-section-label">{text(language, "customLabelPage")}</div>
      <div className="custom-card category-chooser">
        <div className="category-check-grid">
          {sortedCategories.map((category) => (
            <button
              className="category-check"
              key={category.id}
              onClick={() => toggleVisible(category.id)}
              type="button"
            >
              <span
                className={`square-check ${viewSettings.visibleCategoryIds.includes(category.id) ? "square-check-on" : ""}`}
                style={{ "--chip-color": category.color } as CSSProperties}
              >
                {viewSettings.visibleCategoryIds.includes(category.id) ? <Check size={20} strokeWidth={3} /> : null}
              </span>
              <span>{categoryLabel(category, language)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="custom-section-label">{text(language, "filters")}</div>
      <div className="custom-card filter-card">
        {filterKeys.map((filter) => {
          const active = viewSettings.activeFilters.includes(filter);
          return (
            <button
              aria-pressed={active}
              className={`filter-row filter-toggle ${active ? "filter-row-active" : ""}`}
              key={filter}
              onClick={() => toggleFilter(filter)}
              type="button"
            >
              <span>{text(language, filter)}</span>
              <span className="filter-indicator">{active ? <Check size={20} strokeWidth={3} /> : null}</span>
            </button>
          );
        })}
        <div className="date-filter-wrap">
          <button
            aria-expanded={dateMenuOpen}
            className={`filter-row date-filter-row ${viewSettings.dateFilter !== "all" ? "filter-row-active" : ""}`}
            onClick={() => setDateMenuOpen((open) => !open)}
            type="button"
          >
            <span>{text(language, "date")}</span>
            <strong>{selectedDateLabel} <ChevronDown size={19} /></strong>
          </button>
          {dateMenuOpen ? (
            <div className="date-filter-menu">
              {dateOptions.map((option) => (
                <button
                  className={`date-filter-option ${viewSettings.dateFilter === option.id ? "date-filter-option-active" : ""}`}
                  key={option.id}
                  onClick={() => {
                    changeDateFilter(option.id);
                    setDateMenuOpen(false);
                  }}
                  type="button"
                >
                  <span>{option.label}</span>
                  {viewSettings.dateFilter === option.id ? <Check size={18} strokeWidth={3} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="custom-section-label">{text(language, "newRule")}</div>
      <div className="custom-card">
        <div className="rule-grid">
          <label>
            {language === "zh" ? "匹配字段" : "Field"}
            <select value={field} onChange={(event) => setField(event.target.value as RuleField)}>
              <option value="domain">{language === "zh" ? "邮箱后缀" : "Email domain"}</option>
              <option value="sender">{language === "zh" ? "发送者" : "Sender"}</option>
              <option value="subject">{language === "zh" ? "主题" : "Subject"}</option>
              <option value="content">{language === "zh" ? "正文/预览" : "Content"}</option>
            </select>
          </label>
          <label>
            {language === "zh" ? "归入分类" : "Category"}
            <select value={targetCategoryId} onChange={(event) => setTargetCategoryId(event.target.value)}>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id}>{categoryLabel(category, language)}</option>
              ))}
            </select>
          </label>
        </div>
        <input
          className="rule-value-input"
          onChange={(event) => setValue(event.target.value)}
          placeholder={language === "zh" ? "例如 SCC 或 Career Centre" : "e.g. SCC or Career Centre"}
          value={value}
        />
        <button className="primary-wide" onClick={createRule} type="button">
          {language === "zh" ? "保存规则并重新分类" : "Save rule and reclassify"}
        </button>
      </div>

      <div className="custom-section-label">{language === "zh" ? "当前规则" : "Current Rules"}</div>
      <div className="custom-card">
        <div className="rules-list">
          {rules.map((rule) => {
            const category = categories.find((item) => item.id === rule.categoryId);
            const categoryName = category ? categoryLabel(category, language) : rule.categoryId;
            const ruleLabel = `${fieldLabel(rule.field, language)} ${language === "zh" ? "包含" : "contains"} “${rule.value}”`;
            return (
              <div className="rule-row" key={rule.id}>
                <span>{ruleLabel}</span>
                <div className="rule-row-actions">
                  <strong>{categoryName}</strong>
                  <button
                    aria-label={`${language === "zh" ? "删除规则" : "Delete rule"}：${ruleLabel} ${categoryName}`}
                    className="rule-delete-button"
                    onClick={() => onDeleteRule(rule.id)}
                    title={language === "zh" ? "删除规则" : "Delete rule"}
                    type="button"
                  >
                    <Trash2 size={17} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function fieldLabel(field: RuleField, language: Language) {
  if (field === "domain") return language === "zh" ? "邮箱后缀" : "Domain";
  if (field === "sender") return language === "zh" ? "发送者" : "Sender";
  if (field === "subject") return language === "zh" ? "主题" : "Subject";
  return language === "zh" ? "正文" : "Content";
}
