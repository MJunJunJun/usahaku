import { useEffect, useRef } from "react";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Quote, Undo2 } from "lucide-react";
import { articleToHtml, sanitizeArticleHtml } from "../lib/articleContent";

const actions = [["formatBlock", "P", "Paragraf"], ["formatBlock", "H2", "H2"], ["formatBlock", "H3", "H3"], ["bold", null, <Bold size={16} />], ["italic", null, <Italic size={16} />], ["insertUnorderedList", null, <List size={16} />], ["insertOrderedList", null, <ListOrdered size={16} />], ["formatBlock", "BLOCKQUOTE", <Quote size={16} />], ["undo", null, <Undo2 size={16} />]];

export default function ArticleEditor({ value, onChange }) {
  const editor = useRef(null);
  useEffect(() => { if (editor.current && editor.current.innerHTML !== articleToHtml(value)) editor.current.innerHTML = articleToHtml(value); }, [value]);
  const run = (command, arg) => { editor.current?.focus(); document.execCommand(command, false, arg); onChange(sanitizeArticleHtml(editor.current?.innerHTML || "")); };
  const addLink = () => { const url = window.prompt("Masukkan URL tautan (https://...)"); if (url) run("createLink", url); };
  return <div className="article-editor"><div className="article-toolbar" role="toolbar" aria-label="Format isi artikel">{actions.map(([command, arg, label], index) => <button key={index} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => run(command, arg)} aria-label={typeof label === "string" ? label : command}>{label}</button>)}<button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addLink} aria-label="Tambahkan tautan"><LinkIcon size={16} /></button></div><div ref={editor} className="article-editor-canvas" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" data-placeholder="Tulis artikel Anda. Gunakan H2 untuk bagian utama dan H3 untuk subbagian." onInput={(e) => onChange(sanitizeArticleHtml(e.currentTarget.innerHTML))} /></div>;
}
