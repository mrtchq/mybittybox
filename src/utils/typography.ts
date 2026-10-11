export interface FontOption {
  id: string;
  name: string;
  category: 'Sans-Serif' | 'Serif' | 'Monospace' | 'Display';
  fontFamily: string;
  webSafe: boolean;
  description: string;
}

export const PREDEFINED_FONTS: FontOption[] = [
  {
    id: 'system-sans',
    name: 'System Default Sans',
    category: 'Sans-Serif',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    webSafe: true,
    description: 'Clean, modern, high-contrast native system typography',
  },
  {
    id: 'inter',
    name: 'Inter / Modern UI',
    category: 'Sans-Serif',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    webSafe: true,
    description: 'Neutral, highly readable geometric Grotesque style',
  },
  {
    id: 'monospace-code',
    name: 'JetBrains / Monospace',
    category: 'Monospace',
    fontFamily: 'ui-monospace, "JetBrains Mono", "Fira Code", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    webSafe: true,
    description: 'Technical developer monospace for code, ascii art & terminals',
  },
  {
    id: 'courier-new',
    name: 'Courier New',
    category: 'Monospace',
    fontFamily: '"Courier New", Courier, monospace',
    webSafe: true,
    description: 'Classic mechanical typewriter fixed-pitch font',
  },
  {
    id: 'georgia',
    name: 'Georgia',
    category: 'Serif',
    fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
    webSafe: true,
    description: 'Warm, elegant editorial serif designed specifically for screens',
  },
  {
    id: 'times-new-roman',
    name: 'Times New Roman',
    category: 'Serif',
    fontFamily: '"Times New Roman", Times, Baskerville, serif',
    webSafe: true,
    description: 'Traditional, scholarly serif ideal for formal and academic documents',
  },
  {
    id: 'palatino',
    name: 'Palatino / Book Antiqua',
    category: 'Serif',
    fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
    webSafe: true,
    description: 'Classical Renaissance proportions with open letterforms',
  },
  {
    id: 'verdana',
    name: 'Verdana',
    category: 'Sans-Serif',
    fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
    webSafe: true,
    description: 'Generous letter-spacing and tall x-height for maximum screen legibility',
  },
  {
    id: 'trebuchet-ms',
    name: 'Trebuchet MS',
    category: 'Sans-Serif',
    fontFamily: '"Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", sans-serif',
    webSafe: true,
    description: 'Distinguished humanist sans-serif with subtle open flares',
  },
  {
    id: 'arial',
    name: 'Arial / Helvetica',
    category: 'Sans-Serif',
    fontFamily: 'Arial, Helvetica, sans-serif',
    webSafe: true,
    description: 'Universal workhorse neutral neo-grotesque sans-serif',
  },
  {
    id: 'lucida-console',
    name: 'Lucida Console',
    category: 'Monospace',
    fontFamily: '"Lucida Console", "Lucida Sans Typewriter", Monaco, monospace',
    webSafe: true,
    description: 'Retro CRT retro-futuristic terminal monospace',
  },
  {
    id: 'garamond',
    name: 'Garamond',
    category: 'Serif',
    fontFamily: 'Garamond, "Baskerville", "Hoefler Text", "Times New Roman", serif',
    webSafe: true,
    description: 'Sophisticated literary serif with delicate contrasts',
  },
  {
    id: 'impact',
    name: 'Impact',
    category: 'Display',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    webSafe: true,
    description: 'Ultra-condensed heavy industrial display font for impactful titles',
  },
  {
    id: 'comic-sans',
    name: 'Comic Sans MS',
    category: 'Display',
    fontFamily: '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
    webSafe: true,
    description: 'Playful, informal handwriting style for casual notes and games',
  },
];

/**
 * Detect the active font from existing content string or metadata
 */
export function detectFontFromContent(content: string, fallbackId?: string): string {
  if (!content) return fallbackId || 'system-sans';

  // 1. Check for explicit font markers or font-family declarations in content
  for (const font of PREDEFINED_FONTS) {
    // Check by font id marker
    if (content.includes(`data-bitty-font="${font.id}"`)) {
      return font.id;
    }
    // Check for distinctive font name inside font-family declarations
    if (font.id === 'georgia' && /font-family:[^;]*Georgia/i.test(content)) return 'georgia';
    if (font.id === 'courier-new' && /font-family:[^;]*Courier New/i.test(content)) return 'courier-new';
    if (font.id === 'times-new-roman' && /font-family:[^;]*Times New Roman/i.test(content)) return 'times-new-roman';
    if (font.id === 'palatino' && /font-family:[^;]*(Palatino|Book Antiqua)/i.test(content)) return 'palatino';
    if (font.id === 'verdana' && /font-family:[^;]*Verdana/i.test(content)) return 'verdana';
    if (font.id === 'trebuchet-ms' && /font-family:[^;]*Trebuchet/i.test(content)) return 'trebuchet-ms';
    if (font.id === 'lucida-console' && /font-family:[^;]*Lucida Console/i.test(content)) return 'lucida-console';
    if (font.id === 'garamond' && /font-family:[^;]*Garamond/i.test(content)) return 'garamond';
    if (font.id === 'impact' && /font-family:[^;]*Impact/i.test(content)) return 'impact';
    if (font.id === 'comic-sans' && /font-family:[^;]*Comic Sans/i.test(content)) return 'comic-sans';
    if (font.id === 'monospace-code' && /font-family:[^;]*(JetBrains|Fira Code|monospace)/i.test(content)) return 'monospace-code';
    if (font.id === 'inter' && /font-family:[^;]*Inter/i.test(content)) return 'inter';
    if (font.id === 'arial' && /font-family:[^;]*Arial/i.test(content)) return 'arial';
  }

  return fallbackId || 'system-sans';
}

/**
 * Apply a selected font family to the Bitty Box content.
 * Updates existing font-family in body or style, or injects a dedicated style block.
 */
export function applyFontToContent(content: string, fontId: string): string {
  const font = PREDEFINED_FONTS.find(f => f.id === fontId) || PREDEFINED_FONTS[0];
  const fontCss = font.fontFamily;
  const styleRule = `body { font-family: ${fontCss}; }`;

  if (!content || !content.trim()) {
    return `<style id="bitty-typography" data-bitty-font="${font.id}">\n  ${styleRule}\n</style>\n`;
  }

  // Case 1: Existing dedicated bitty typography style tag
  const bittyFontTagRegex = /<style\s+id=["']bitty-typography["'][^>]*>[\s\S]*?<\/style>/i;
  if (bittyFontTagRegex.test(content)) {
    return content.replace(
      bittyFontTagRegex,
      `<style id="bitty-typography" data-bitty-font="${font.id}">\n  ${styleRule}\n</style>`
    );
  }

  // Case 2: Content has an existing <style> block containing body font-family
  const bodyWithFontRegex = /(body\s*\{[^}]*?font-family\s*:\s*)([^;]+)(;?[^}]*?\})/i;
  if (bodyWithFontRegex.test(content)) {
    return content.replace(bodyWithFontRegex, `$1${fontCss}$3`);
  }

  // Case 3: Content has an existing <style> block with body { ... } but without font-family
  const bodyBlockRegex = /(body\s*\{)([^}]*?\})/i;
  if (bodyBlockRegex.test(content)) {
    return content.replace(bodyBlockRegex, `$1\n    font-family: ${fontCss};$2`);
  }

  // Case 4: Content has a <style> block, but no body rule inside
  const firstStyleRegex = /(<style[^>]*>)/i;
  if (firstStyleRegex.test(content)) {
    return content.replace(firstStyleRegex, `$1\n  ${styleRule}`);
  }

  // Case 5: Content has <head>...</head>
  if (/<head[^>]*>/i.test(content)) {
    return content.replace(
      /(<head[^>]*>)/i,
      `$1\n  <style id="bitty-typography" data-bitty-font="${font.id}">\n    ${styleRule}\n  </style>`
    );
  }

  // Case 6: Content has <html> without <head>
  if (/<html[^>]*>/i.test(content)) {
    return content.replace(
      /(<html[^>]*>)/i,
      `$1\n<head>\n  <style id="bitty-typography" data-bitty-font="${font.id}">\n    ${styleRule}\n  </style>\n</head>`
    );
  }

  // Case 7: HTML snippet or plain text: Prepend clean style block
  return `<style id="bitty-typography" data-bitty-font="${font.id}">\n  ${styleRule}\n</style>\n${content}`;
}
