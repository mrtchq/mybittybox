/**
 * Content Analysis Utilities
 * Computes estimated read time and structural code complexity scores
 * for HTML, JavaScript, Markdown, and text content in Bitty Box editor.
 */

export interface ContentAnalysisResult {
  charCount: number;
  wordCount: number;
  lineCount: number;
  readTimeSeconds: number;
  readTimeString: string;
  complexityScore: number; // 0 to 100
  complexityLevel: 'Minimal' | 'Low' | 'Moderate' | 'High' | 'Complex';
  complexityLabel: string;
  metrics: {
    controlFlowKeywords: number;
    logicalOperators: number;
    functions: number;
    htmlTags: number;
    scriptTags: number;
    maxNestingDepth: number;
  };
}

/**
 * Analyze editor content to estimate reading duration and calculate a
 * structural code complexity metric.
 */
export function analyzeContent(content: string = ''): ContentAnalysisResult {
  const trimmed = content.trim();

  if (!trimmed) {
    return {
      charCount: 0,
      wordCount: 0,
      lineCount: 0,
      readTimeSeconds: 0,
      readTimeString: '0s',
      complexityScore: 0,
      complexityLevel: 'Minimal',
      complexityLabel: 'Empty Canvas',
      metrics: {
        controlFlowKeywords: 0,
        logicalOperators: 0,
        functions: 0,
        htmlTags: 0,
        scriptTags: 0,
        maxNestingDepth: 0,
      },
    };
  }

  const charCount = content.length;
  const lines = content.split(/\r\n|\r|\n/);
  const lineCount = lines.length;

  // Words count (splitting on non-whitespace sequences)
  const words = trimmed.match(/\S+/g) || [];
  const wordCount = words.length;

  // Estimated Read Time:
  // For code and mixed markup, standard human comprehension runs at roughly 150 words per minute.
  // 150 words / 60 seconds = 2.5 words per second.
  const readingSpeedWpm = 150;
  const readTimeSeconds = Math.max(5, Math.round((wordCount / readingSpeedWpm) * 60));

  let readTimeString: string;
  if (readTimeSeconds < 60) {
    readTimeString = `${readTimeSeconds}s`;
  } else {
    const mins = (readTimeSeconds / 60).toFixed(1);
    // If ending in .0, simplify to whole integer
    readTimeString = mins.endsWith('.0') ? `${Math.round(readTimeSeconds / 60)} min` : `${mins} min`;
  }

  // Structural Code Complexity Calculation:
  // 1. Control flow keywords (if, else, for, while, switch, case, try, catch, throw, return)
  const controlKeywordMatches = content.match(/\b(if|else|for|while|switch|case|default|try|catch|finally|throw|return|continue|break)\b/g) || [];
  const controlFlowKeywords = controlKeywordMatches.length;

  // 2. Logical operators & branch indicators (&&, ||, ??, ternary ?)
  const logicalOpMatches = content.match(/(&&|\|\||\?\?|\?(?!\.))/g) || [];
  const logicalOperators = logicalOpMatches.length;

  // 3. Functions, lambdas, classes, async declarations
  const funcMatches = content.match(/\b(function|async|await|class|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|=>)\b/g) || [];
  const functions = funcMatches.length;

  // 4. HTML tags count
  const htmlTagMatches = content.match(/<([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g) || [];
  const htmlTags = htmlTagMatches.length;

  // 5. Script & style embedded elements
  const scriptTagMatches = content.match(/<(script|style)\b[^>]*>/gi) || [];
  const scriptTags = scriptTagMatches.length;

  // 6. Max nesting depth (analyzing brackets and indentation)
  let currentDepth = 0;
  let maxNestingDepth = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{' || ch === '(' || ch === '[') {
      currentDepth++;
      if (currentDepth > maxNestingDepth) {
        maxNestingDepth = currentDepth;
      }
    } else if (ch === '}' || ch === ')' || ch === ']') {
      if (currentDepth > 0) currentDepth--;
    }
  }

  // Raw weighted complexity points
  const rawComplexity =
    controlFlowKeywords * 3 +
    logicalOperators * 2 +
    functions * 3.5 +
    htmlTags * 0.6 +
    scriptTags * 4 +
    maxNestingDepth * 2.5 +
    lineCount * 0.1;

  // Map onto a clean 1-100 scale using smooth logarithmic scaling
  // A raw score of 10 -> ~20, 50 -> ~50, 150 -> ~75, 400+ -> ~95+
  const normalizedScore = Math.min(
    100,
    Math.max(1, Math.round(18 * Math.log2(rawComplexity * 0.45 + 1)))
  );

  let complexityLevel: 'Minimal' | 'Low' | 'Moderate' | 'High' | 'Complex';
  let complexityLabel: string;

  if (normalizedScore <= 15) {
    complexityLevel = 'Minimal';
    complexityLabel = 'Simple & Clear';
  } else if (normalizedScore <= 40) {
    complexityLevel = 'Low';
    complexityLabel = 'Light & Interactive';
  } else if (normalizedScore <= 65) {
    complexityLevel = 'Moderate';
    complexityLabel = 'Moderate Complexity';
  } else if (normalizedScore <= 85) {
    complexityLevel = 'High';
    complexityLabel = 'Rich & Advanced';
  } else {
    complexityLevel = 'Complex';
    complexityLabel = 'Full Interactive App';
  }

  return {
    charCount,
    wordCount,
    lineCount,
    readTimeSeconds,
    readTimeString,
    complexityScore: normalizedScore,
    complexityLevel,
    complexityLabel,
    metrics: {
      controlFlowKeywords,
      logicalOperators,
      functions,
      htmlTags,
      scriptTags,
      maxNestingDepth,
    },
  };
}
