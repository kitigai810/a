'use strict';
const dns = require('node:dns/promises');
const net = require('node:net');

const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

async function readJson(req, limit = MAX_REQUEST_BYTES) {
  let value = req.body;
  if (value === undefined) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > limit) throw Object.assign(new Error('リクエストが大きすぎます。'), { statusCode: 413 });
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    try { value = raw ? JSON.parse(raw) : {}; }
    catch { throw Object.assign(new Error('JSON形式のリクエストを送信してください。'), { statusCode: 400 }); }
  } else if (typeof value === 'string') {
    if (Buffer.byteLength(value) > limit) throw Object.assign(new Error('リクエストが大きすぎます。'), { statusCode: 413 });
    try { value = JSON.parse(value); }
    catch { throw Object.assign(new Error('JSON形式のリクエストを送信してください。'), { statusCode: 400 }); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('リクエスト形式が正しくありません。'), { statusCode: 400 });
  if (Buffer.byteLength(JSON.stringify(value)) > limit) throw Object.assign(new Error('リクエストが大きすぎます。'), { statusCode: 413 });
  return value;
}

function isPrivateAddress(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const p = address.split('.').map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 192 && p[1] === 0 && p[2] === 0) || (p[0] === 198 && (p[1] === 18 || p[1] === 19));
  }
  if (version === 6) {
    const a = address.toLowerCase().split('%')[0];
    if (a === '::' || a === '::1' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe8') || a.startsWith('fe9') || a.startsWith('fea') || a.startsWith('feb') || a.startsWith('ff')) return true;
    const mapped = a.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
  }
  return version === 0;
}

async function validatePublicUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw Object.assign(new Error('有効なURLを入力してください。'), { statusCode: 400 }); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Object.assign(new Error('HTTPまたはHTTPSの公開URLのみ取得できます。'), { statusCode: 400 });
  if (url.port && !['80', '443'].includes(url.port)) throw Object.assign(new Error('標準のHTTP(S)ポートのURLを指定してください。'), { statusCode: 400 });
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw Object.assign(new Error('ローカル／内部ネットワークのURLは取得できません。'), { statusCode: 400 });
  const ipVersion = net.isIP(hostname);
  if (ipVersion) {
    if (isPrivateAddress(hostname)) throw Object.assign(new Error('ローカル／内部ネットワークのURLは取得できません。'), { statusCode: 400 });
  } else {
    let records;
    try { records = await dns.lookup(hostname, { all: true, verbatim: true }); }
    catch { throw Object.assign(new Error('URLのホスト名を解決できません。'), { statusCode: 400 }); }
    if (!records.length || records.some(record => isPrivateAddress(record.address))) throw Object.assign(new Error('公開されたWebサイトのURLのみ取得できます。'), { statusCode: 400 });
  }
  url.hash = '';
  return url;
}

async function fetchText(input, maxBytes = MAX_SOURCE_BYTES, redirectCount = 0) {
  if (redirectCount > 4) throw Object.assign(new Error('リダイレクトが多すぎます。'), { statusCode: 400 });
  const url = await validatePublicUrl(input);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(18000), headers: { 'user-agent': 'SourceAI-Research/1.0 (+https://vercel.com)', accept: 'text/html,text/plain,application/json,*/*;q=0.2' } });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) throw Object.assign(new Error('取得先から不正なリダイレクトが返されました。'), { statusCode: 502 });
    return fetchText(new URL(location, url).toString(), maxBytes, redirectCount + 1);
  }
  if (!response.ok) throw Object.assign(new Error(`取得先がHTTP ${response.status}を返しました。URLと公開設定を確認してください。`), { statusCode: response.status === 404 ? 404 : 502 });
  const contentType = response.headers.get('content-type') || '';
  if (contentType && !/(text\/|application\/(json|javascript|x-javascript|xml)|\+xml|\+json)/i.test(contentType)) throw Object.assign(new Error(`この形式のファイルは読み込めません（${contentType.split(';')[0]}）。テキスト／ソースコードのURLを指定してください。`), { statusCode: 415 });
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw Object.assign(new Error('ソースは1 MB以下にしてください。'), { statusCode: 413 });
  const reader = response.body && response.body.getReader();
  if (!reader) return { text: '', url: url.toString(), contentType };
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw Object.assign(new Error('取得したソースが1 MBを超えています。'), { statusCode: 413 }); }
    chunks.push(Buffer.from(value));
  }
  return { text: new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks)), url: url.toString(), contentType };
}

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(value));
}

module.exports = { MAX_SOURCE_BYTES, MAX_REQUEST_BYTES, readJson, validatePublicUrl, fetchText, json };
