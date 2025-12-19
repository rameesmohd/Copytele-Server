// utils/telegramHtmlConverter.js

/**
 * Decodes HTML entities like &nbsp;, &amp;, &lt;, etc.
 */
function decodeHtmlEntities(text) {
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };

  return text.replace(/&[#\w]+;/g, (entity) => {
    return entities[entity] || entity;
  });
}

/**
 * Converts standard HTML (from React Quill) to Telegram-compatible HTML
 */
export function convertToTelegramHtml(html) {
  if (!html) return "";

  let text = html;

  // Remove <p> tags but keep content and add line breaks
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n");

  // Remove <div> tags but keep content
  text = text.replace(/<div[^>]*>/gi, "");
  text = text.replace(/<\/div>/gi, "\n");

  // Remove <br> tags and replace with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Convert <span> with style to appropriate tags (if styled)
  text = text.replace(/<span[^>]*>/gi, "");
  text = text.replace(/<\/span>/gi, "");

  // Handle lists - convert to plain text with bullets/numbers
  text = text.replace(/<ul[^>]*>/gi, "");
  text = text.replace(/<\/ul>/gi, "\n");
  text = text.replace(/<ol[^>]*>/gi, "");
  text = text.replace(/<\/ol>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "• ");
  text = text.replace(/<\/li>/gi, "\n");

  // Convert headings to bold
  text = text.replace(/<h[1-6][^>]*>/gi, "<b>");
  text = text.replace(/<\/h[1-6]>/gi, "</b>\n");

  // Remove <pre> wrapper from Quill code blocks but keep <code>
  text = text.replace(/<pre[^>]*><code[^>]*>/gi, "<code>");
  text = text.replace(/<\/code><\/pre>/gi, "</code>");

  // ✅ Decode HTML entities (&nbsp;, &amp;, etc.)
  text = decodeHtmlEntities(text);

  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, "\n\n");
  
  // Clean up multiple spaces
  text = text.replace(/  +/g, " ");
  
  // Trim whitespace
  text = text.trim();

  return text;
}