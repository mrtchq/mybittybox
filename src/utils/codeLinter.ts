/**
 * Lightweight Real-Time HTML & CSS Code Linter for Bitty Box
 * 
 * Provides sub-millisecond syntax validation for HTML markup and embedded CSS/JS,
 * detecting unclosed tags, attribute quote mismatches, stray closing tags,
 * duplicate IDs, CSS brace/comment unbalances, missing semicolons, and misspelled CSS properties.
 */

export interface LintIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  type: 'html' | 'css' | 'js';
  message: string;
  line: number;
  column?: number;
  snippet?: string;
  suggestion?: string;
}

export interface LintReport {
  valid: boolean;
  errorsCount: number;
  warningsCount: number;
  issues: LintIssue[];
  summary: string;
}

// Void HTML elements that cannot have end tags and cannot contain child content
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

// Common CSS property misspellings with corrections
const CSS_PROPERTY_FIXES: Record<string, string> = {
  'colr': 'color',
  'clor': 'color',
  'colour': 'color',
  'widht': 'width',
  'witdh': 'width',
  'heigth': 'height',
  'heigt': 'height',
  'backgroud': 'background',
  'backgroun': 'background',
  'bg': 'background',
  'pading': 'padding',
  'paddng': 'padding',
  'margn': 'margin',
  'magin': 'margin',
  'font-famly': 'font-family',
  'font-fmily': 'font-family',
  'text-algn': 'text-align',
  'text-aline': 'text-align',
  'boder': 'border',
  'bordr': 'border',
  'positon': 'position',
  'postition': 'position',
  'opasity': 'opacity',
  'disply': 'display',
  'dispaly': 'display',
  'z-indx': 'z-index',
  'algn-items': 'align-items',
  'justfy-content': 'justify-content',
};

/**
 * Main linter entry point: analyzes HTML and embedded CSS/JS
 */
export function lintHtmlCssCode(code: string): LintReport {
  const issues: LintIssue[] = [];
  if (!code || !code.trim()) {
    return {
      valid: true,
      errorsCount: 0,
      warningsCount: 0,
      issues: [],
      summary: 'Editor is empty. No syntax issues found.'
    };
  }

  const lines = code.split('\n');

  // 1. Run HTML Structure Linting
  lintHtmlTags(code, lines, issues);

  // 2. Run Duplicate ID check
  lintDuplicateIds(code, lines, issues);

  // 3. Run Embedded CSS Linting (<style>...</style>)
  lintEmbeddedCss(code, lines, issues);

  // 4. Run Embedded JS checks (<script>...</script>)
  lintEmbeddedJs(code, lines, issues);

  // 5. Run DOMParser sanity check (browser environment)
  lintWithDomParser(code, issues);

  // Sort issues by line number
  issues.sort((a, b) => a.line - b.line);

  const errorsCount = issues.filter(i => i.severity === 'error').length;
  const warningsCount = issues.filter(i => i.severity === 'warning').length;

  let summary = 'All HTML/CSS syntax checks passed!';
  if (errorsCount > 0 && warningsCount > 0) {
    summary = `Found ${errorsCount} error${errorsCount > 1 ? 's' : ''} and ${warningsCount} warning${warningsCount > 1 ? 's' : ''}.`;
  } else if (errorsCount > 0) {
    summary = `Found ${errorsCount} syntax error${errorsCount > 1 ? 's' : ''} in your markup.`;
  } else if (warningsCount > 0) {
    summary = `Found ${warningsCount} syntax warning${warningsCount > 1 ? 's' : ''}.`;
  }

  return {
    valid: errorsCount === 0,
    errorsCount,
    warningsCount,
    issues,
    summary
  };
}

/**
 * Validates opening and closing HTML tags, tag nesting, and unclosed quotes
 */
function lintHtmlTags(code: string, lines: string[], issues: LintIssue[]): void {
  // Stack of open tags: { tag: string; line: number; index: number }
  const tagStack: { tag: string; line: number; raw: string }[] = [];

  // Match HTML comments to ignore them
  // Regex to scan HTML tags: <(/)?([a-zA-Z0-9\-]+)([^>]*)>
  const tagRegex = /<(?:\/)?([a-zA-Z0-9\-]+)(?:[^>]*?)>/g;

  // Let's also check for unclosed `<` brackets that never finish with `>`
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineText = lines[lineIdx];
    const lineNum = lineIdx + 1;

    // Check for unclosed tag starting on this line and followed immediately by another tag
    const unclosedStartMatch = lineText.match(/<([a-zA-Z0-9\-]+)[^>]*<([a-zA-Z0-9\-]+)/);
    if (unclosedStartMatch) {
      issues.push({
        id: `unclosed-bracket-${lineNum}`,
        severity: 'error',
        type: 'html',
        message: `Possible missing closing '>' on tag '<${unclosedStartMatch[1]}'`,
        line: lineNum,
        snippet: lineText.trim(),
        suggestion: `Close the tag with '>' before opening '<${unclosedStartMatch[2]}'>`
      });
    }

    // Check for unclosed attribute quote on single tag declaration
    const openQuoteAttrMatch = lineText.match(/<[a-zA-Z0-9\-]+[^>]*?\s[a-zA-Z\-]+=("[^"]*|'[^']*)$/);
    if (openQuoteAttrMatch) {
      issues.push({
        id: `unclosed-quote-${lineNum}`,
        severity: 'error',
        type: 'html',
        message: `Unclosed attribute quote in tag declaration`,
        line: lineNum,
        snippet: lineText.trim(),
        suggestion: `Add closing quote matching ${openQuoteAttrMatch[1][0]}`
      });
    }
  }

  // Tokenize tags while ignoring <script> and <style> inner bodies
  let inScript = false;
  let inStyle = false;
  let inComment = false;

  // Split content by character index to map to line number
  const getLineFromIndex = (idx: number): number => {
    return code.slice(0, idx).split('\n').length;
  };

  const comprehensiveTagRegex = /<!--[\s\S]*?-->|<\/script>|<\/style>|<script\b[^>]*>|<style\b[^>]*>|<\/([a-zA-Z0-9\-]+)>|<([a-zA-Z0-9\-]+)([^>]*?)(\/?)>/gi;
  let match: RegExpExecArray | null;

  while ((match = comprehensiveTagRegex.exec(code)) !== null) {
    const fullMatch = match[0];
    const matchIndex = match.index;
    const lineNum = getLineFromIndex(matchIndex);

    // Comment
    if (fullMatch.startsWith('<!--')) {
      continue;
    }

    // Script handling
    if (fullMatch.toLowerCase().startsWith('<script')) {
      inScript = true;
      tagStack.push({ tag: 'script', line: lineNum, raw: fullMatch });
      continue;
    }
    if (fullMatch.toLowerCase() === '</script>') {
      inScript = false;
      const top = tagStack.pop();
      if (!top || top.tag !== 'script') {
        issues.push({
          id: `stray-closing-script-${lineNum}`,
          severity: 'error',
          type: 'html',
          message: `Stray closing tag </script> with no opening <script>`,
          line: lineNum,
          snippet: lines[lineNum - 1]?.trim(),
        });
      }
      continue;
    }
    if (inScript) continue;

    // Style handling
    if (fullMatch.toLowerCase().startsWith('<style')) {
      inStyle = true;
      tagStack.push({ tag: 'style', line: lineNum, raw: fullMatch });
      continue;
    }
    if (fullMatch.toLowerCase() === '</style>') {
      inStyle = false;
      const top = tagStack.pop();
      if (!top || top.tag !== 'style') {
        issues.push({
          id: `stray-closing-style-${lineNum}`,
          severity: 'error',
          type: 'html',
          message: `Stray closing tag </style> with no opening <style>`,
          line: lineNum,
          snippet: lines[lineNum - 1]?.trim(),
        });
      }
      continue;
    }
    if (inStyle) continue;

    // Closing tag
    if (match[1]) {
      const closingTag = match[1].toLowerCase();
      if (VOID_ELEMENTS.has(closingTag)) {
        issues.push({
          id: `void-closing-${lineNum}-${closingTag}`,
          severity: 'warning',
          type: 'html',
          message: `Void element <${closingTag}> should not have a closing </${closingTag}> tag`,
          line: lineNum,
          snippet: lines[lineNum - 1]?.trim(),
          suggestion: `Remove </${closingTag}>`
        });
        continue;
      }

      // Look back in stack
      const last = tagStack.length > 0 ? tagStack[tagStack.length - 1] : null;
      if (!last) {
        issues.push({
          id: `stray-tag-${lineNum}-${closingTag}`,
          severity: 'error',
          type: 'html',
          message: `Stray closing tag </${closingTag}> has no matching opening tag`,
          line: lineNum,
          snippet: lines[lineNum - 1]?.trim(),
          suggestion: `Ensure an opening <${closingTag}> exists or remove </${closingTag}>`
        });
      } else if (last.tag === closingTag) {
        // Matched
        tagStack.pop();
      } else {
        // Mismatch!
        issues.push({
          id: `mismatched-tag-${lineNum}-${closingTag}`,
          severity: 'error',
          type: 'html',
          message: `Mismatched closing tag </${closingTag}> (expected </${last.tag}> opened at line ${last.line})`,
          line: lineNum,
          snippet: lines[lineNum - 1]?.trim(),
          suggestion: `Close </${last.tag}> before closing </${closingTag}>`
        });
        // Pop if found deeper
        const foundIdx = tagStack.map(t => t.tag).lastIndexOf(closingTag);
        if (foundIdx >= 0) {
          tagStack.splice(foundIdx, 1);
        }
      }
      continue;
    }

    // Opening tag
    if (match[2]) {
      const tagName = match[2].toLowerCase();
      const isSelfClosing = match[4] === '/' || VOID_ELEMENTS.has(tagName);
      if (!isSelfClosing) {
        tagStack.push({ tag: tagName, line: lineNum, raw: fullMatch });
      }
    }
  }

  // Any remaining unclosed tags on the stack
  for (const unclosed of tagStack) {
    // Only report non-void tags (html/body/head are often omitted in snippets, but div/p/section etc. must be closed)
    if (!['html', 'body', 'head'].includes(unclosed.tag)) {
      issues.push({
        id: `unclosed-tag-${unclosed.line}-${unclosed.tag}`,
        severity: 'error',
        type: 'html',
        message: `Unclosed <${unclosed.tag}> tag opened at line ${unclosed.line}`,
        line: unclosed.line,
        snippet: lines[unclosed.line - 1]?.trim(),
        suggestion: `Add a closing </${unclosed.tag}> tag`
      });
    }
  }
}

/**
 * Detects duplicate id="..." attributes in HTML markup
 */
function lintDuplicateIds(code: string, lines: string[], issues: LintIssue[]): void {
  const idMap = new Map<string, number>();
  const idRegex = /\bid\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = idRegex.exec(code)) !== null) {
    const idVal = match[1].trim();
    if (!idVal) continue;

    const lineNum = code.slice(0, match.index).split('\n').length;
    if (idMap.has(idVal)) {
      const prevLine = idMap.get(idVal)!;
      issues.push({
        id: `duplicate-id-${lineNum}-${idVal}`,
        severity: 'warning',
        type: 'html',
        message: `Duplicate ID '${idVal}' found (first defined at line ${prevLine})`,
        line: lineNum,
        snippet: lines[lineNum - 1]?.trim(),
        suggestion: `IDs must be unique within an HTML document. Use a CSS class instead.`
      });
    } else {
      idMap.set(idVal, lineNum);
    }
  }
}

/**
 * Checks embedded CSS in <style> tags (or entire file if CSS)
 */
function lintEmbeddedCss(code: string, lines: string[], issues: LintIssue[]): void {
  const styleBlockRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch: RegExpExecArray | null;

  while ((styleMatch = styleBlockRegex.exec(code)) !== null) {
    const cssBody = styleMatch[1];
    const startIndex = styleMatch.index + styleMatch[0].indexOf(cssBody);
    const startLine = code.slice(0, startIndex).split('\n').length;

    lintCssString(cssBody, startLine, lines, issues);
  }
}

/**
 * Lints a CSS block for brace balance, comment balance, empty properties, and misspelled properties
 */
function lintCssString(css: string, startLine: number, lines: string[], issues: LintIssue[]): void {
  const cssLines = css.split('\n');
  let openBraces = 0;
  let inComment = false;

  for (let i = 0; i < cssLines.length; i++) {
    const rawLine = cssLines[i];
    const lineNum = startLine + i;
    const trimmed = rawLine.trim();

    // Check unclosed comment on this line
    if (trimmed.includes('/*') && !trimmed.includes('*/')) {
      inComment = true;
    } else if (trimmed.includes('*/')) {
      inComment = false;
    }

    if (inComment) continue;

    // Count braces
    for (const ch of rawLine) {
      if (ch === '{') openBraces++;
      if (ch === '}') {
        openBraces--;
        if (openBraces < 0) {
          issues.push({
            id: `stray-css-brace-${lineNum}`,
            severity: 'error',
            type: 'css',
            message: `Stray closing brace '}' in CSS rule`,
            line: lineNum,
            snippet: trimmed,
            suggestion: `Remove the unmatched '}'`
          });
          openBraces = 0;
        }
      }
    }

    // Check CSS property misspellings & syntax
    if (openBraces > 0 && trimmed && !trimmed.startsWith('@') && !trimmed.startsWith('/*')) {
      // Check for empty declarations: e.g. "color:;" or "margin: ;"
      const emptyDeclMatch = trimmed.match(/^([a-zA-Z\-]+)\s*:\s*;?$/);
      if (emptyDeclMatch) {
        issues.push({
          id: `empty-css-prop-${lineNum}`,
          severity: 'error',
          type: 'css',
          message: `Empty CSS property '${emptyDeclMatch[1]}' has no value`,
          line: lineNum,
          snippet: trimmed,
          suggestion: `Provide a valid value for '${emptyDeclMatch[1]}'`
        });
      }

      // Check for misspelled properties
      const propMatch = trimmed.match(/^([a-zA-Z\-]+)\s*:/);
      if (propMatch) {
        const propName = propMatch[1].toLowerCase();
        if (CSS_PROPERTY_FIXES[propName]) {
          issues.push({
            id: `misspelled-css-prop-${lineNum}`,
            severity: 'warning',
            type: 'css',
            message: `Unknown or misspelled CSS property '${propName}'`,
            line: lineNum,
            snippet: trimmed,
            suggestion: `Did you mean '${CSS_PROPERTY_FIXES[propName]}'?`
          });
        }
      }

      // Check for missing semicolon when next declaration follows
      if (i < cssLines.length - 1) {
        const nextLine = cssLines[i + 1].trim();
        if (
          trimmed.includes(':') && 
          !trimmed.endsWith(';') && 
          !trimmed.endsWith('{') && 
          !trimmed.endsWith('}') && 
          !trimmed.endsWith(',') && 
          nextLine.includes(':')
        ) {
          issues.push({
            id: `missing-semicolon-${lineNum}`,
            severity: 'warning',
            type: 'css',
            message: `Missing semicolon ';' at the end of CSS declaration`,
            line: lineNum,
            snippet: trimmed,
            suggestion: `Append ';' to '${trimmed}'`
          });
        }
      }
    }
  }

  // Unclosed braces at end of style block
  if (openBraces > 0) {
    issues.push({
      id: `unclosed-css-brace-${startLine + cssLines.length - 1}`,
      severity: 'error',
      type: 'css',
      message: `Unclosed curly brace '{' in CSS styles (${openBraces} remaining)`,
      line: startLine + cssLines.length - 1,
      suggestion: `Add closing '}' to match open rules`
    });
  }

  if (inComment) {
    issues.push({
      id: `unclosed-css-comment-${startLine}`,
      severity: 'error',
      type: 'css',
      message: `Unclosed CSS comment /* without matching */`,
      line: startLine,
      suggestion: `Close the CSS comment with */`
    });
  }
}

/**
 * Checks embedded JS in <script> tags
 */
function lintEmbeddedJs(code: string, lines: string[], issues: LintIssue[]): void {
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(code)) !== null) {
    const jsBody = match[1];
    const startIndex = match.index + match[0].indexOf(jsBody);
    const startLine = code.slice(0, startIndex).split('\n').length;
    const jsLines = jsBody.split('\n');

    let openParen = 0;
    let openBrace = 0;

    for (let j = 0; j < jsLines.length; j++) {
      const lineText = jsLines[j];
      const currentLine = startLine + j;

      for (const ch of lineText) {
        if (ch === '(') openParen++;
        if (ch === ')') openParen = Math.max(0, openParen - 1);
        if (ch === '{') openBrace++;
        if (ch === '}') openBrace = Math.max(0, openBrace - 1);
      }
    }

    if (openParen > 0) {
      issues.push({
        id: `unclosed-paren-js-${startLine}`,
        severity: 'warning',
        type: 'js',
        message: `Unbalanced '(' parentheses in <script> code`,
        line: startLine,
        suggestion: `Ensure all function calls and conditions have matching ')'`
      });
    }
    if (openBrace > 0) {
      issues.push({
        id: `unclosed-brace-js-${startLine}`,
        severity: 'warning',
        type: 'js',
        message: `Unbalanced '{' braces in <script> code`,
        line: startLine,
        suggestion: `Ensure all functions and blocks have matching '}'`
      });
    }
  }
}

/**
 * Uses the browser DOMParser if available to cross-validate HTML markup
 */
function lintWithDomParser(code: string, issues: LintIssue[]): void {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return;

  try {
    const parser = new DOMParser();
    // Parse as XML or HTML
    const doc = parser.parseFromString(code, 'text/html');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      const errorText = parserError.textContent || '';
      issues.push({
        id: `dom-parser-error`,
        severity: 'error',
        type: 'html',
        message: `HTML Parser Issue: ${errorText.slice(0, 100)}`,
        line: 1,
        suggestion: `Check your markup structure and tag closures.`
      });
    }
  } catch {}
}
