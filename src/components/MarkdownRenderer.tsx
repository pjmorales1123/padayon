"use client";

import React from "react";

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

function renderInline(text: string): React.ReactNode {
  // Code spans
  const parts: React.ReactNode[] = [];
  const codeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++}>{renderBoldItalicLinks(text.slice(lastIndex, match.index))}</span>
      );
    }
    parts.push(
      <code
        key={key++}
        className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono text-pink-600"
      >
        {match[1]}
      </code>
    );
    lastIndex = codeRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{renderBoldItalicLinks(text.slice(lastIndex))}</span>);
  }

  return parts.length > 0 ? parts : renderBoldItalicLinks(text);
}

function renderBoldItalicLinks(text: string): React.ReactNode {
  // Process links first, then bold/italic on each text fragment.
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const fragments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragments.push(
        <span key={key++}>{renderBoldItalic(text.slice(lastIndex, match.index))}</span>
      );
    }
    fragments.push(
      <a
        key={key++}
        href={match[2]}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 underline hover:text-blue-800"
      >
        {match[1]}
      </a>
    );
    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    fragments.push(<span key={key++}>{renderBoldItalic(text.slice(lastIndex))}</span>);
  }

  return fragments.length > 0 ? fragments : renderBoldItalic(text);
}

function renderBoldItalic(text: string): React.ReactNode {
  // Split by ** pairs, treating odd indices as bold content.
  const boldParts = text.split("**");
  if (boldParts.length < 3) {
    // No complete bold pair; process italic only.
    return renderItalic(text);
  }

  const nodes: React.ReactNode[] = [];
  let key = 0;
  boldParts.forEach((part, idx) => {
    if (idx % 2 === 1) {
      nodes.push(<strong key={key++}>{renderItalic(part)}</strong>);
    } else if (part) {
      nodes.push(<span key={key++}>{renderItalic(part)}</span>);
    }
  });
  return nodes;
}

function renderItalic(text: string): React.ReactNode {
  // Split by * pairs, treating odd indices as italic content.
  const italicParts = text.split("*");
  if (italicParts.length < 3) {
    return text;
  }
  const nodes: React.ReactNode[] = [];
  let key = 0;
  italicParts.forEach((part, idx) => {
    if (idx % 2 === 1) {
      nodes.push(<em key={key++}>{part}</em>);
    } else if (part) {
      nodes.push(<span key={key++}>{part}</span>);
    }
  });
  return nodes;
}

function parseTable(lines: string[]): { headers: string[]; rows: string[][] } {
  const headers = lines[0]
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((h) => h.trim());
  const rows = lines.slice(2).map((line) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim())
  );
  return { headers, rows };
}

function renderTable(lines: string[]): React.ReactNode {
  const { headers, rows } = parseTable(lines);
  return (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            {headers.map((h, i) => (
              <th
                key={i}
                className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800"
              >
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? "bg-slate-50" : "bg-white"}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-slate-300 px-3 py-2 text-slate-700">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarkdownRenderer({ children, className = "" }: MarkdownRendererProps) {
  const lines = children.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const start = i + 1;
      let end = start;
      while (end < lines.length && !lines[end].trim().startsWith("```")) {
        end++;
      }
      const code = lines.slice(start, end).join("\n");
      elements.push(
        <pre
          key={key++}
          className="my-3 rounded-xl bg-slate-900 p-4 overflow-x-auto text-xs text-slate-100 font-mono"
        >
          {lang && <div className="text-slate-400 mb-2 text-[10px] uppercase">{lang}</div>}
          <code>{code}</code>
        </pre>
      );
      i = end + 1;
      continue;
    }

    // Table
    if (trimmed.startsWith("|")) {
      const tableLines = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      if (tableLines.length >= 2) {
        elements.push(<React.Fragment key={key++}>{renderTable(tableLines)}</React.Fragment>);
        i = j;
        continue;
      }
    }

    // Headers
    if (/^#{1,6}\s+/.test(trimmed)) {
      const level = trimmed.match(/^(#{1,6})\s+/)?.[1].length || 1;
      const text = trimmed.replace(/^#{1,6}\s+/, "");
      const sizeClasses = [
        "text-xl font-bold",
        "text-lg font-bold",
        "text-base font-bold",
        "text-sm font-bold",
        "text-sm font-semibold",
        "text-xs font-semibold",
      ];
      const headingClass = `${sizeClasses[level - 1]} mt-4 mb-2 text-slate-900`;
      elements.push(
        level === 1 ? (
          <h1 key={key++} className={headingClass}>{renderInline(text)}</h1>
        ) : level === 2 ? (
          <h2 key={key++} className={headingClass}>{renderInline(text)}</h2>
        ) : level === 3 ? (
          <h3 key={key++} className={headingClass}>{renderInline(text)}</h3>
        ) : level === 4 ? (
          <h4 key={key++} className={headingClass}>{renderInline(text)}</h4>
        ) : level === 5 ? (
          <h5 key={key++} className={headingClass}>{renderInline(text)}</h5>
        ) : (
          <h6 key={key++} className={headingClass}>{renderInline(text)}</h6>
        )
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      elements.push(<hr key={key++} className="my-4 border-slate-200" />);
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      elements.push(
        <blockquote
          key={key++}
          className="my-3 border-l-4 border-blue-300 pl-4 italic text-slate-600 bg-slate-50 py-2 rounded-r"
        >
          {renderBlockContent(quoteLines.join("\n"))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^(\*|\-|\+)\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^(\*|\-|\+)\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^(\*|\-|\+)\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={key++} className="my-2 list-disc list-inside space-y-1 text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (supports multi-line items and blank lines between items)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      let current = "";
      let inList = true;
      let j = i;
      while (j < lines.length && inList) {
        const lineAtJ = lines[j];
        const trimmedAtJ = lineAtJ.trim();
        const isNumbered = /^\d+\.\s+/.test(trimmedAtJ);
        const isIndented = lineAtJ.startsWith(" ") || lineAtJ.startsWith("\t");

        if (isNumbered) {
          if (current) items.push(current.trim());
          current = trimmedAtJ.replace(/^\d+\.\s+/, "");
          j++;
        } else if (trimmedAtJ === "") {
          // Blank line: keep inside list if next non-blank line belongs to list
          let k = j + 1;
          while (k < lines.length && lines[k].trim() === "") k++;
          const next = lines[k] || "";
          const nextTrimmed = next.trim();
          const nextIsNumbered = /^\d+\.\s+/.test(nextTrimmed);
          const nextIsIndented = next.startsWith(" ") || next.startsWith("\t");
          if (nextIsNumbered || nextIsIndented) {
            current += "\n";
            j++;
          } else {
            inList = false;
          }
        } else if (isIndented && current) {
          // Continuation of current item
          current += "\n" + trimmedAtJ;
          j++;
        } else {
          inList = false;
        }
      }
      if (current) items.push(current.trim());
      i = j;
      elements.push(
        <ol key={key++} className="my-2 list-decimal list-inside space-y-2 text-slate-700">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {item.split("\n").map((line, lineIdx, arr) => (
                <span key={lineIdx}>
                  {renderInline(line)}
                  {lineIdx < arr.length - 1 && <br />}
                </span>
              ))}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (trimmed === "") {
      elements.push(<div key={key++} className="h-2" />);
      i++;
      continue;
    }

    // Paragraph / inline line
    elements.push(
      <p key={key++} className="my-1 leading-relaxed text-slate-700">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className={`markdown ${className}`}>{elements}</div>;
}

function renderBlockContent(text: string): React.ReactNode {
  // Used inside blockquote to render inline content as paragraphs
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <p key={i} className="my-1">
      {renderInline(line)}
    </p>
  ));
}
