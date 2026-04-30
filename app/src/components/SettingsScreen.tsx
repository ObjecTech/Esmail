import { Check, ChevronDown, ChevronLeft } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { categoryLabel, text } from "../language";
import type { Category, Language, RuleField, SettingsMode, SortRule } from "../types";
import { IconButton } from "./IconButton";

interface SettingsScreenProps {
  categories: Category[];
  language: Language;
  mode: SettingsMode;
  rules: SortRule[];
  onAddCategory: (category: Category) => void;
  onAddRule: (rule: SortRule) => void;
  onBack: () => void;
}

const colors = ["#4ab3ff", "#7bd300", "#ffb21a", "#ef4d73", "#7f807e", "#7b6cf6", "#c838d8"];

export function SettingsScreen({ categories, language, mode, rules, onAddCategory, onAddRule, onBack }: SettingsScreenProps) {
  const [label, setLabel] = useState(language === "zh" ? "学生" : "Student");
  const [hint, setHint] = useState(language === "zh" ? "课程、导师、学校后缀等邮件" : "Course, tutor, and school-domain emails");
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [field, setField] = useState<RuleField>("domain");
  const [value, setValue] = useState("student.edu");
  const [targetCategoryId, setTargetCategoryId] = useState(categories[categories.length - 1]?.id || "important");
  const [visibleCategoryIds, setVisibleCategoryIds] = useState(() => categories.map((category) => category.id));

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.order - b.order), [categories]);

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
    setVisibleCategoryIds((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId]
    );
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
        <IconButton label="返回" onClick={onBack}>
          <ChevronLeft size={29} />
        </IconButton>
        <h1>{text(language, "customView")}</h1>
        <button className="big-confirm" onClick={onBack} type="button" aria-label="保存自定义视图">
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
                className={`square-check ${visibleCategoryIds.includes(category.id) ? "square-check-on" : ""}`}
                style={{ "--chip-color": category.color } as CSSProperties}
              >
                {visibleCategoryIds.includes(category.id) ? <Check size={20} strokeWidth={3} /> : null}
              </span>
              <span>{categoryLabel(category, language)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="custom-section-label">{text(language, "filters")}</div>
      <div className="custom-card filter-card">
        <div className="filter-row">{text(language, "unread")}</div>
        <div className="filter-row">{text(language, "sentToMe")}</div>
        <div className="filter-row">{text(language, "ccMe")}</div>
        <div className="filter-row">{text(language, "attachments")}</div>
        <div className="filter-row">
          <span>{text(language, "date")}</span>
          <strong>{language === "zh" ? "所有日期" : "All dates"} <ChevronDown size={19} /></strong>
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
          placeholder="例如 student.edu 或 Tutor"
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
            return (
              <div className="rule-row" key={rule.id}>
                <span>{fieldLabel(rule.field, language)} {language === "zh" ? "包含" : "contains"} “{rule.value}”</span>
                <strong>{category ? categoryLabel(category, language) : rule.categoryId}</strong>
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
