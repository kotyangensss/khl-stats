// Isolated component preview: Next adapters are replaced, production components are unchanged.
// Usage: node tests/ui-preview/build.mjs <absolute-output-directory>
import { build } from "esbuild";
import { mkdir, readFile, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw new Error("An absolute output directory is required");
await mkdir(path.join(output, "images"), { recursive: true });
const adapters = {
  "next/link": `import React from 'react'; export default function Link({href,children,...props}) { const url=href==='/'?'ui-preview.html':href==='/standings'?'ui-preview.html?view=standings':href==='/#schedule'?'ui-preview.html#schedule':href; return <a href={url} {...props}>{children}</a>; }`,
  "next/image": `import React from 'react'; export default function Image({fill,priority,unoptimized,sizes,...props}) { return <img {...props} style={{...props.style,...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{})}} />; }`,
  "next/navigation": `import {useSyncExternalStore} from 'react'; const subscribe=fn=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)}; function navigate(url){const next=new URL(url,location.origin);history.pushState(null,'',location.pathname+next.search);dispatchEvent(new PopStateEvent('popstate'))} export const useRouter=()=>({push:navigate,replace:navigate}); export const usePathname=()=>'/'; export function useSearchParams(){const query=useSyncExternalStore(subscribe,()=>location.search);return new URLSearchParams(query)}`,
};
await build({ entryPoints: ["tests/ui-preview/entry.tsx"], bundle: true, outfile: path.join(output, "ui-preview.js"), jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "next-preview-adapters", setup(builder) {
  builder.onResolve({ filter: /^next\/(link|image|navigation)$/ }, args => ({ path: args.path, namespace: "preview" }));
  builder.onLoad({ filter: /.*/, namespace: "preview" }, args => ({ contents: adapters[args.path], loader: "jsx", resolveDir: process.cwd() }));
} }] });
await copyFile("public/images/hockey-hero-red.webp", path.join(output, "images/hockey-hero-red.webp"));
const css = await readFile("app/hockey.css", "utf8");
await writeFile(path.join(output, "ui-preview.html"), `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Проверка компонентов · тестовые данные</title><link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Oswald:wght@500;600;700&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}html{--font-body:'Golos Text';--font-display:'Oswald'}body{background:#101010;color:#f3f3ed;font-family:var(--font-body),sans-serif}a{color:inherit}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}${css}</style><div id="root"></div><script src="ui-preview.js"></script></html>`);
await writeFile(path.join(output, "ui-mobile.html"), `<!doctype html><html><meta charset="utf-8"><title>Проверка 390px</title><style>body{margin:0;background:#333;display:flex;justify-content:center}iframe{width:390px;height:900px;border:0}</style><iframe src="ui-preview.html?view=${process.argv[3] || "standings"}" title="Мобильный интерфейс — 390px"></iframe></html>`);
console.log("Component preview written to", output);
