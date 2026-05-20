/**
 * HTML sanitizer for PDF template data.
 *
 * User-controlled strings (job names, client names, notes) are interpolated
 * into Puppeteer HTML templates. This util strips any injected script tags,
 * event handlers, or other executable content before the string reaches
 * page.setContent(), closing the Puppeteer RCE vector.
 */
import _sanitize from "sanitize-html";

// sanitize-html has mixed default/named exports across CJS/ESM; normalise to a callable.
const sanitize: typeof _sanitize = (
  typeof (_sanitize as unknown as { default: typeof _sanitize }).default === "function"
    ? (_sanitize as unknown as { default: typeof _sanitize }).default
    : _sanitize
);

/** Tags that are safe in PDF-rendered HTML — no interactive or executable elements. */
const ALLOWED_TAGS = [
  "p", "br", "b", "i", "em", "strong", "u", "s", "span", "div",
  "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "img",
];

const ALLOWED_ATTRIBUTES: _sanitize.IOptions["allowedAttributes"] = {
  "a": ["href", "target"],
  "img": ["src", "alt", "width", "height"],
  "td": ["colspan", "rowspan", "style"],
  "th": ["colspan", "rowspan", "style"],
  "span": ["style"],
  "div": ["style"],
  "p": ["style"],
  "table": ["style"],
};

/** Strip HTML from a value intended for a plain-text PDF slot (names, addresses, IDs). */
export function sanitizeText(value: string): string {
  return sanitize(value, { allowedTags: [], allowedAttributes: {} });
}

/**
 * Sanitize a value that may legitimately contain safe HTML markup (e.g. rich-text notes).
 * Scripts, event handlers, and iframes are always removed.
 */
export function sanitizeRichText(value: string): string {
  return sanitize(value, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // Never allow javascript: URIs
    allowedSchemes: ["http", "https", "mailto", "data"],
    disallowedTagsMode: "discard",
  });
}
