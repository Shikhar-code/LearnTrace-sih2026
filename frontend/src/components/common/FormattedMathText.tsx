import React, { useMemo } from 'react';
import katex from 'katex';

interface FormattedMathTextProps {
  content: string;
  className?: string;
  isWorkedExample?: boolean;
}

/**
 * Renders rich text containing LaTeX math ($...$ or $$...$$), Markdown bold/italics,
 * bullet lists, and structured step-by-step worked examples.
 */
export const FormattedMathText: React.FC<FormattedMathTextProps> = ({
  content,
  className = '',
  isWorkedExample = false,
}) => {
  if (!content) return null;

  // Helper to safely render KaTeX math or fallback to raw string
  const renderMath = (math: string, displayMode: boolean): string => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode,
        throwOnError: false,
        output: 'htmlAndMathml',
      });
    } catch {
      return math;
    }
  };

  // Parses a single line or paragraph for inline math and basic markdown formatting
  const parseInlineElements = (text: string): React.ReactNode[] => {
    // Regex for:
    // 1. Block math: $$...$$ or \[...\]
    // 2. Inline math: $...$ or \(...\)
    // 3. Bold: **...**
    // 4. Inline code: `...`
    // 5. Italic: *...*
    const tokenRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$(?:\\\$|[^\$])+?\$|\\\([\s\S]*?\\\)|\*\*[\s\S]*?\*\*|`[^`]+?`|\*[^\*]+?\*)/g;

    const parts = text.split(tokenRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // 1. Block Math $$ ... $$ or \[ ... \]
      if (
        (part.startsWith('$$') && part.endsWith('$$')) ||
        (part.startsWith('\\[') && part.endsWith('\\]'))
      ) {
        const raw = part.startsWith('$$') ? part.slice(2, -2) : part.slice(2, -2);
        const html = renderMath(raw, true);
        return (
          <span
            key={index}
            className="block my-2 text-center overflow-x-auto py-1"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      // 2. Inline Math $ ... $ or \( ... \)
      if (
        (part.startsWith('$') && part.endsWith('$') && part.length > 2) ||
        (part.startsWith('\\(') && part.endsWith('\\)'))
      ) {
        const raw = part.startsWith('$') ? part.slice(1, -1) : part.slice(2, -2);
        const html = renderMath(raw, false);
        return (
          <span
            key={index}
            className="inline-math inline px-0.5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      // 3. Bold ** ... **
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const raw = part.slice(2, -2);
        return (
          <strong key={index} className="font-bold text-stone-900">
            {parseInlineElements(raw)}
          </strong>
        );
      }

      // 4. Inline Code ` ... `
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        const raw = part.slice(1, -1);
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 bg-stone-100 border border-stone-200 rounded font-mono text-[11px] text-teal-800"
          >
            {raw}
          </code>
        );
      }

      // 5. Italic * ... *
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        const raw = part.slice(1, -1);
        return (
          <em key={index} className="italic text-stone-800">
            {parseInlineElements(raw)}
          </em>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  // Structured rendering for Worked Examples (Steps, Problem, Solution)
  const renderedWorkedExample = useMemo(() => {
    if (!isWorkedExample) return null;

    // Detect if content has "Step 1:", "Step 2:" or numbered sections
    const stepRegex = /(?:^|\n)(?:###\s*)?(?:Step\s*(\d+)[:.]?|(\d+)\.\s*Step[:.]?)\s*/i;
    const hasSteps = stepRegex.test(content);

    if (!hasSteps) {
      // Fallback: render paragraphs with clean visual styling
      return (
        <div className="space-y-3">
          {content.split(/\n\s*\n/).map((para, pIdx) => (
            <p key={pIdx} className="leading-relaxed">
              {parseInlineElements(para)}
            </p>
          ))}
        </div>
      );
    }

    // Split into step segments
    const lines = content.split('\n');
    const sections: { title?: string; body: string[] }[] = [];
    let currentSection: { title?: string; body: string[] } = { body: [] };

    for (const line of lines) {
      const match = line.match(/^(?:###\s*)?(?:Step\s*(\d+)[:.]?|(\d+)\.\s*Step[:.]?)(.*)/i);
      if (match) {
        if (currentSection.body.length > 0 || currentSection.title) {
          sections.push(currentSection);
        }
        const stepNum = match[1] || match[2];
        const stepDesc = match[3]?.replace(/^[:\s-]+/, '').trim() || `Step ${stepNum}`;
        currentSection = {
          title: `Step ${stepNum}: ${stepDesc}`,
          body: [],
        };
      } else {
        currentSection.body.push(line);
      }
    }
    if (currentSection.body.length > 0 || currentSection.title) {
      sections.push(currentSection);
    }

    return (
      <div className="space-y-3">
        {sections.map((sec, idx) => {
          const bodyText = sec.body.join('\n').trim();
          return (
            <div
              key={idx}
              className="bg-white rounded-lg border border-stone-200/90 p-3.5 shadow-2xs space-y-1.5"
            >
              {sec.title && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-900 rounded font-bold text-[11px] uppercase tracking-wide">
                    {sec.title.split(':')[0]}
                  </span>
                  <span className="font-semibold text-stone-900 text-xs">
                    {sec.title.includes(':') ? sec.title.split(':').slice(1).join(':').trim() : ''}
                  </span>
                </div>
              )}
              {bodyText && (
                <div className="text-xs text-stone-700 leading-relaxed pt-0.5 space-y-1">
                  {bodyText.split(/\n+/).map((line, lIdx) => (
                    <div key={lIdx}>{parseInlineElements(line)}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }, [content, isWorkedExample]);

  if (isWorkedExample && renderedWorkedExample) {
    return <div className={`formatted-math-text ${className}`}>{renderedWorkedExample}</div>;
  }

  // Standard Paragraph & List parsing for general explanations
  const paragraphs = content.split(/\n\s*\n/);

  return (
    <div className={`formatted-math-text space-y-2.5 ${className}`}>
      {paragraphs.map((para, pIdx) => {
        const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);

        // Check if paragraph is a bullet list
        const isBulletList = lines.length > 1 && lines.every((l) => /^[-*•]\s+/.test(l));
        if (isBulletList) {
          return (
            <ul key={pIdx} className="list-disc pl-5 space-y-1 text-stone-800">
              {lines.map((item, iIdx) => (
                <li key={iIdx} className="leading-relaxed">
                  {parseInlineElements(item.replace(/^[-*•]\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        }

        // Check if paragraph is a numbered list
        const isNumList = lines.length > 1 && lines.every((l) => /^\d+\.\s+/.test(l));
        if (isNumList) {
          return (
            <ol key={pIdx} className="list-decimal pl-5 space-y-1 text-stone-800">
              {lines.map((item, iIdx) => (
                <li key={iIdx} className="leading-relaxed">
                  {parseInlineElements(item.replace(/^\d+\.\s+/, ''))}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={pIdx} className="leading-relaxed">
            {parseInlineElements(para)}
          </p>
        );
      })}
    </div>
  );
};
