import React from "react";

export function formatRichText(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements: React.ReactElement[] = [];
  let listItems: string[] = [];
  let numberedItems: string[] = [];
  let subListItems: string[] = [];

  const flushSubList = () => {
    if (subListItems.length > 0) {
      const parent = listItems.length > 0 ? listItems : numberedItems;
      if (parent.length > 0) {
        const lastIdx = parent.length - 1;
        parent[lastIdx] = parent[lastIdx] + "\n__SUB__" + subListItems.join("\n__SUB__");
      }
      subListItems = [];
    }
  };

  const flushList = () => {
    flushSubList();
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-2 my-4">
          {listItems.map((item, i) => {
            const parts = item.split("\n__SUB__");
            const mainText = parts[0];
            const subs = parts.slice(1);
            return (
              <li key={i}>
                <div className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-2.5 shrink-0" />
                  <span className="text-[15px] leading-relaxed text-foreground/80">{formatInlineText(mainText)}</span>
                </div>
                {subs.length > 0 && (
                  <ul className="ml-8 mt-1 space-y-1">
                    {subs.map((sub, si) => (
                      <li key={si} className="flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-2.5 shrink-0" />
                        <span className="text-sm leading-relaxed text-foreground/70">{formatInlineText(sub)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      );
      listItems = [];
    }
    if (numberedItems.length > 0) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="space-y-3 my-4">
          {numberedItems.map((item, i) => {
            const parts = item.split("\n__SUB__");
            const mainText = parts[0];
            const subs = parts.slice(1);
            return (
              <li key={i}>
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-[15px] leading-relaxed text-foreground/80">{formatInlineText(mainText)}</span>
                </div>
                {subs.length > 0 && (
                  <ul className="ml-10 mt-1 space-y-1">
                    {subs.map((sub, si) => (
                      <li key={si} className="flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-2.5 shrink-0" />
                        <span className="text-sm leading-relaxed text-foreground/70">{formatInlineText(sub)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      );
      numberedItems = [];
    }
  };

  const formatInlineText = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|__.*?__|`[^`]+`|\[([^\]]+)\]\(([^)]+)\))/g);
    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("__") && part.endsWith("__")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={i} className="italic text-foreground/70">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-foreground/90">{part.slice(1, -1)}</code>;
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">{linkMatch[1]}</a>;
      }
      return <span key={i}>{part}</span>;
    }).filter(Boolean);
  };

  const hasExplicitMarkdown = lines.some(l => {
    const t = l.trim();
    return t.startsWith("# ") || t.startsWith("## ") || t.startsWith("### ") ||
           t.startsWith("- ") || t.startsWith("* ") || t.startsWith("• ") ||
           /^\d+[\.\)]\s+/.test(t) || t.startsWith("> ");
  });

  const isAllCaps = (s: string): boolean => {
    const letters = s.replace(/[^a-zA-Z]/g, "");
    return letters.length >= 2 && letters === letters.toUpperCase();
  };

  const isImplicitHeading = (line: string, index: number): boolean => {
    if (hasExplicitMarkdown) return false;
    if (line.length > 50 || line.length < 3) return false;
    if (line.endsWith(".") || line.endsWith(",") || line.endsWith(";") || line.endsWith("!") || line.endsWith("?")) return false;
    const wordCount = line.split(/\s+/).length;
    if (wordCount > 6) return false;
    if (isAllCaps(line)) {
      const prevLine = index > 0 ? lines[index - 1]?.trim() : "";
      const nextLine = index < lines.length - 1 ? lines[index + 1]?.trim() : "";
      if ((index === 0 || prevLine === "") && nextLine !== "") return true;
    }
    return false;
  };

  const isImplicitSubHeading = (line: string, index: number): boolean => {
    if (hasExplicitMarkdown) return false;
    if (line.length > 60 || line.length < 3) return false;
    if (line.endsWith(".") || line.endsWith(",") || line.endsWith(";")) return false;
    const wordCount = line.split(/\s+/).length;
    if (wordCount > 8) return false;
    const colonMatch = line.match(/^([^:]+):$/);
    if (colonMatch && wordCount <= 5) {
      const prevLine = index > 0 ? lines[index - 1]?.trim() : "";
      if (index === 0 || prevLine === "") return true;
    }
    return false;
  };

  const isLabelValueLine = (line: string): { label: string; value: string } | null => {
    const match = line.match(/^([A-Z][A-Za-z\s]{1,30}):\s+(.+)$/);
    if (match && match[1].split(/\s+/).length <= 4) {
      return { label: match[1], value: match[2] };
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h2 key={`h-${i}`} className="text-2xl font-serif font-bold text-foreground mt-8 mb-3 first:mt-0 pb-2 border-b border-border/50">
          {line.slice(2)}
        </h2>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={`h-${i}`} className="text-xl font-serif font-semibold text-foreground mt-6 mb-2">
          {line.slice(3)}
        </h3>
      );
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={`h-${i}`} className="text-lg font-semibold text-foreground mt-5 mb-2">
          {line.slice(4)}
        </h4>
      );
      continue;
    }

    if (line.startsWith("#### ")) {
      flushList();
      elements.push(
        <h5 key={`h-${i}`} className="text-base font-semibold text-foreground mt-4 mb-1.5">
          {line.slice(5)}
        </h5>
      );
      continue;
    }

    const indentedBullet = lines[i].match(/^(\s{2,}|\t+)[-•*]\s+(.*)/);
    if (indentedBullet && (listItems.length > 0 || numberedItems.length > 0)) {
      subListItems.push(indentedBullet[2]);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("• ")) {
      flushSubList();
      listItems.push(line.slice(2));
      continue;
    }

    if (line.startsWith("* ") && !line.endsWith("*")) {
      flushSubList();
      listItems.push(line.slice(2));
      continue;
    }

    const numberedMatch = line.match(/^\d+[\.\)]\s+(.*)/);
    if (numberedMatch) {
      flushSubList();
      numberedItems.push(numberedMatch[1]);
      continue;
    }

    const letterMatch = line.match(/^[a-zA-Z][\.\)]\s+(.*)/);
    if (letterMatch) {
      flushSubList();
      listItems.push(letterMatch[1]);
      continue;
    }

    if (line.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote key={`bq-${i}`} className="border-l-4 border-primary/30 pl-4 py-2 my-4 bg-primary/5 rounded-r-lg">
          <p className="text-[15px] leading-relaxed italic text-foreground/70">{formatInlineText(line.slice(2))}</p>
        </blockquote>
      );
      continue;
    }

    if (line.startsWith("---") || line.startsWith("***") || line.startsWith("===")) {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-6 border-border/50" />);
      continue;
    }

    if (isImplicitHeading(line, i)) {
      flushList();
      const display = line.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      elements.push(
        <h2 key={`h-${i}`} className="text-2xl font-serif font-bold text-foreground mt-8 mb-3 first:mt-0 pb-2 border-b border-border/50">
          {display}
        </h2>
      );
      continue;
    }

    if (isImplicitSubHeading(line, i)) {
      flushList();
      elements.push(
        <h3 key={`h-${i}`} className="text-xl font-serif font-semibold text-foreground mt-6 mb-2">
          {line.endsWith(":") ? line.slice(0, -1) : line}
        </h3>
      );
      continue;
    }

    const labelValue = isLabelValueLine(line);
    if (labelValue) {
      flushList();
      elements.push(
        <p key={`lv-${i}`} className="text-[15px] leading-[1.8] text-foreground/80 my-2">
          <strong className="font-semibold text-foreground">{labelValue.label}:</strong>{" "}
          {formatInlineText(labelValue.value)}
        </p>
      );
      continue;
    }

    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-[15px] leading-[1.8] text-foreground/80 my-3">
        {formatInlineText(line)}
      </p>
    );
  }

  flushList();
  return elements;
}
