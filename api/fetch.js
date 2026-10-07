'use strict';
const { readJson, MAX_SOURCE_BYTES, fetchText, validatePublicUrl, json } = require('../lib/shared');

const ALLOWED_EXT = /\.(html?|xhtml|md|txt|json|js|jsx|mjs|cjs|ts|tsx|css|scss|py|go|rs|c|h|cpp|hpp|java|kt|php|vue|svelte|xml|ya?ml|toml|sh)$/i;
function githubParts(url) {
  const m = url.hostname.toLowerCase() === 'github.com' && url.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/i, ''), rest: m[3] || '' } : null;
}
function excerptPage(text, contentType) {
  return text;
}
async function githubFile(link, maxBytes) {
  const rest = link.rest;
  const match = rest.match(/^blob\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(link.owner)}/${encodeURIComponent(link.repo)}/${match[1]}/${match[2].split('/').map(encodeURIComponent).join('/')}`;
  const result = await fetchText(rawUrl, maxBytes);
  return { ...result, label: `${link.owner}/${link.repo}/${match[2]}` };
}
async function githubRepository(link, maxBytes) {
  const api = async url => {
    const result = await fetchText(url, Math.min(maxBytes, 5 * 1024 * 1024));
    try { return JSON.parse(result.text); }
    catch { throw Object.assign(new Error('GitHub APIの応答を読み取れませんでした。'), { statusCode: 502 }); }
  };
  const root = `https://api.github.com/repos/${encodeURIComponent(link.owner)}/${encodeURIComponent(link.repo)}`;
  const repo = await api(root);
  if (!repo.default_branch) throw Object.assign(new Error('GitHubの公開リポジトリを特定できません。'), { statusCode: 404 });
  const tree = await api(`${root}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`);
  if (!Array.isArray(tree.tree)) throw Object.assign(new Error('GitHubのファイル一覧を取得できませんでした。'), { statusCode: 502 });
  const entries = tree.tree.filter(item => item.type === 'blob' && ALLOWED_EXT.test(item.path) && !/(^|\/)(node_modules|vendor|dist|build|\.git|coverage|\.next)\//i.test(item.path));
  const priority = p => (/^index\.html?$/i.test(p) ? 0 : /(^|\/)index\.html?$/i.test(p) ? 1 : /\.(html?|xhtml)$/i.test(p) ? 2 : /\.(js|ts|jsx|tsx|vue|svelte)$/i.test(p) ? 3 : /\.(css|scss)$/i.test(p) ? 4 : /(^|\/)README\.md$/i.test(p) ? 5 : 6);
  entries.sort((a, b) => priority(a.path) - priority(b.path) || a.path.length - b.path.length);
  let output = '';
  let readCount = 0;
  for (const entry of entries.slice(0, 24)) {
    const remaining = maxBytes - Buffer.byteLength(output);
    if (remaining < 2048) break;
    const fileLimit = Math.min(remaining - 300, 150000);
    const raw = `https://raw.githubusercontent.com/${encodeURIComponent(link.owner)}/${encodeURIComponent(link.repo)}/${encodeURIComponent(repo.default_branch)}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
    try {
      const file = await fetchText(raw, fileLimit);
      const section = `\n\n/* ---- ${entry.path} ---- */\n${file.text}`;
      if (Buffer.byteLength(output + section) > maxBytes) break;
      output += section;
      readCount += 1;
    } catch (error) {
      if (error.statusCode === 413) continue;
      throw error;
    }
  }
  if (!output) throw Object.assign(new Error('読み込めるHTML／ソースファイルが見つかりませんでした。ファイルURLを指定するか、コードを直接貼り付けてください。'), { statusCode: 404 });
  return { text: output, url: `https://github.com/${link.owner}/${link.repo}`, label: `${link.owner}/${link.repo}（${readCount}ファイル / ${repo.default_branch}）`, contentType: 'text/plain' };
}

module.exports = async function fetchSource(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POSTで送信してください。' });
  let body;
  try { body = await readJson(req, 32 * 1024); }
  catch (error) { return json(res, error.statusCode || 400, { error: error.message || 'URLを読み取れませんでした。' }); }
  if (typeof body.url !== 'string' || body.url.length > 2048) return json(res, 400, { error: '有効なソースURLを入力してください。' });
  try {
    const safeUrl = await validatePublicUrl(body.url);
    const link = githubParts(safeUrl);
    let result;
    if (link && /^blob\//i.test(link.rest)) result = await githubFile(link, MAX_SOURCE_BYTES);
    else if (link && (!link.rest || /^tree\//i.test(link.rest))) result = await githubRepository(link, MAX_SOURCE_BYTES);
    if (!result) {
      result = await fetchText(safeUrl.toString(), MAX_SOURCE_BYTES);
      result.label = safeUrl.hostname + safeUrl.pathname;
    }
    result.text = excerptPage(result.text, result.contentType);
    if (!result.text.trim()) return json(res, 422, { error: 'URLからテキストを取得できましたが、本文が空でした。' });
    return json(res, 200, { source: result.text, url: result.url, label: result.label, bytes: Buffer.byteLength(result.text), contentType: result.contentType || 'text/plain' });
  } catch (error) {
    return json(res, error.statusCode || 502, { error: error.message || 'URLからソースを取得できませんでした。公開設定をご確認ください。' });
  }
};
