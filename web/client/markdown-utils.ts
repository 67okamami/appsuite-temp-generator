import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ breaks: true });

export function safeMarkdown(md: string) {
  return unsafeHTML(DOMPurify.sanitize(marked.parse(md) as string));
}
