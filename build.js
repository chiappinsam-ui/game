#!/usr/bin/env node
/* Bundles Strikepoint into single-file builds:
   dist/strikepoint.html  — standalone page (open directly in a browser; three.js from CDN)
   dist/artifact.html     — same page as a body fragment for hosting inside a page skeleton */
const fs = require('fs'), path = require('path');
const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const scripts = ['config', 'audio', 'textures', 'map', 'effects', 'weapons', 'player', 'bots', 'hud', 'game', 'main'];
const js = scripts.map(n => `/* ===== js/${n}.js ===== */\n` + fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8')).join('\n\n');

let out = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>');
// drop the local fallback loader and the individual script tags; inline everything
out = out.replace(/<script>if \(!window\.THREE\)[\s\S]*?<\/script>\n/, '');
out = out.replace(/<script src="js\/config\.js"><\/script>[\s\S]*?<script src="js\/main\.js"><\/script>/, '<script>\n' + js.replace(/<\/script>/g, '<\\/script>') + '\n</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/strikepoint.html'), out);

// artifact fragment: no doctype/html/head/body wrappers; <title> + <style> first
let frag = out.replace(/^[\s\S]*?<head>/, '').replace('</head>', '').replace(/<\/?body>/g, '').replace('</html>', '');
frag = frag.replace(/<meta charset="utf-8">\n|<meta name="viewport"[^>]*>\n/g, '');
// move <title> to the very top
const titleMatch = frag.match(/<title>.*?<\/title>\n?/); if (titleMatch) frag = titleMatch[0] + frag.replace(titleMatch[0], '');
fs.writeFileSync(path.join(root, 'dist/artifact.html'), frag.trim() + '\n');
console.log('built dist/strikepoint.html (' + (out.length / 1024).toFixed(0) + ' KB) and dist/artifact.html (' + (frag.length / 1024).toFixed(0) + ' KB)');
