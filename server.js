import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
};

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = parsedUrl.pathname;

  // Route: /demo -> Interactive Amazon Simulation
  if (pathname === '/demo' || pathname === '/demo/') {
    const demoPath = path.join(__dirname, 'final build', '02_store_listing_assets', 'video', 'demo_preview.html');
    return serveFile(res, demoPath);
  }

  // Route: /video -> Video presentation
  if (pathname === '/video' || pathname === '/video/') {
    const videoHtml = path.join(__dirname, 'final build', '02_store_listing_assets', 'video', 'index.html');
    return serveFile(res, videoHtml);
  }

  // Route: /download/zip -> Extension Zip Package
  if (pathname === '/download/zip') {
    const zipPath = path.join(__dirname, 'final build', '01_extension_package', 'kdp-niche-finder-v1.0.0.zip');
    res.setHeader('Content-Disposition', 'attachment; filename="kdp-niche-finder-v1.0.0.zip"');
    return serveFile(res, zipPath);
  }

  // Route: /extension/* -> files inside .output/chrome-mv3
  if (pathname.startsWith('/extension/')) {
    const relPath = pathname.replace('/extension/', '');
    const extFilePath = path.join(__dirname, '.output', 'chrome-mv3', relPath);
    return serveFile(res, extFilePath);
  }

  // Route: /assets/* -> static files
  if (pathname.startsWith('/assets/')) {
    const assetPath = path.join(__dirname, pathname);
    if (fs.existsSync(assetPath)) {
      return serveFile(res, assetPath);
    }
  }

  // Route: /final-build/* -> static assets
  if (pathname.startsWith('/final-build/')) {
    const rel = pathname.replace('/final-build/', '');
    const fbPath = path.join(__dirname, 'final build', rel);
    if (fs.existsSync(fbPath)) {
      return serveFile(res, fbPath);
    }
  }

  // Media files from video folder
  if (pathname.endsWith('.webp') || pathname.endsWith('.jpg') || pathname.endsWith('.png')) {
    const candidateVideo = path.join(__dirname, 'final build', '02_store_listing_assets', 'video', path.basename(pathname));
    if (fs.existsSync(candidateVideo)) {
      return serveFile(res, candidateVideo);
    }
    const candidateImg = path.join(__dirname, 'final build', '02_store_listing_assets', 'images', path.basename(pathname));
    if (fs.existsSync(candidateImg)) {
      return serveFile(res, candidateImg);
    }
  }

  // Default Route: / -> Live Dashboard
  const dashboardHtml = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KDP Niche Finder — Live Test Center (Port 3000)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at top right, #1e1b4b, #0f172a 50%, #030712);
      color: #f8fafc;
      font-family: 'Inter', 'Hind Siliguri', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 30px 20px 60px;
    }
    .container {
      max-width: 1020px;
      width: 100%;
    }
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 28px;
      padding: 12px 20px;
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      backdrop-filter: blur(10px);
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.35);
      color: #4ade80;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 10px #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }
    .header {
      text-align: center;
      margin-bottom: 34px;
    }
    h1 {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #ffffff 0%, #38bdf8 60%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    p.lead {
      color: #94a3b8;
      font-size: 16px;
      max-width: 680px;
      margin: 0 auto;
      line-height: 1.6;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(12px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: rgba(56, 189, 248, 0.4);
    }
    .card.highlight {
      border: 1px solid rgba(99, 102, 241, 0.5);
      background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), rgba(15, 23, 42, 0.85) 60%);
    }
    .card-title {
      font-size: 19px;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .card-desc {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 20px;
      flex-grow: 1;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
      border: none;
      width: 100%;
    }
    .btn-primary {
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      color: white;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.35);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #1d4ed8, #2563eb);
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
    }
    .btn-green {
      background: linear-gradient(135deg, #16a34a, #22c55e);
      color: #052e16;
      box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);
      font-weight: 700;
    }
    .btn-green:hover {
      background: linear-gradient(135deg, #15803d, #16a34a);
      color: white;
    }
    .btn-amber {
      background: linear-gradient(135deg, #d97706, #f59e0b);
      color: #451a03;
      font-weight: 700;
    }
    .btn-amber:hover {
      background: linear-gradient(135deg, #b45309, #d97706);
      color: white;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      color: white;
    }
    .guide-box {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 28px;
      margin-top: 10px;
    }
    .guide-box h2 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .steps {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .step {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: rgba(30, 41, 59, 0.4);
      padding: 14px 18px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .step-num {
      background: #3b82f6;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
    }
    .step-content {
      flex: 1;
      font-size: 14px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .code-pill {
      background: #090d16;
      color: #38bdf8;
      font-family: monospace;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 13px;
      border: 1px solid rgba(56, 189, 248, 0.2);
    }
    .copy-box {
      margin-top: 8px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .copy-input {
      flex: 1;
      background: #020617;
      border: 1px solid #334155;
      padding: 8px 12px;
      border-radius: 6px;
      color: #f1f5f9;
      font-family: monospace;
      font-size: 12px;
    }
    .copy-btn {
      background: #1e293b;
      border: 1px solid #475569;
      color: #f8fafc;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s;
    }
    .copy-btn:hover {
      background: #334155;
    }
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #22c55e;
      color: #052e16;
      font-weight: 700;
      padding: 12px 20px;
      border-radius: 10px;
      display: none;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      z-index: 100;
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- Top Bar -->
    <div class="top-bar">
      <div style="font-weight: 700; font-size: 15px; color: #e2e8f0; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">⚡</span> KDP Niche Finder Local Server
      </div>
      <div class="status-pill">
        <span class="status-dot"></span> Live on Port 3000
      </div>
    </div>

    <!-- Header -->
    <div class="header">
      <h1>KDP Niche Finder — Live Test & Launch Center</h1>
      <p class="lead">
        আপনার ব্রাউজার এক্সটেনশন সম্পূর্ণ বিল্ড হয়ে প্রস্তুত আছে। আপনি নিচের অপশনগুলি থেকে সরাসরি ক্রোম ব্রাউজারে এক্সটেনশন লোড করতে পারেন অথবা সিমুলেটেড অ্যামাজন পেইজে লাইভ ফিচার টেস্ট করতে পারেন।
      </p>
    </div>

    <!-- Main Grid -->
    <div class="grid">
      <!-- Card 1: Live Amazon -->
      <div class="card highlight">
        <div>
          <div class="card-title">
            <span style="font-size: 22px;">🛒</span> Amazon.com-এ লাইভ টেস্ট
          </div>
          <div class="card-desc">
            ক্রোম ব্রাউজারে এক্সটেনশনটি লোড করা থাকলে, সরাসরি অ্যামাজন বুকস সার্চ পেজ খুললেই ডানপাশে নিশ স্কোর গজ (0–100), BSR, প্রফিট এবং উইক কম্পিটিটর সাইডবার লোড হবে।
          </div>
        </div>
        <a href="https://www.amazon.com/s?k=toddler+coloring+book&i=stripbooks" target="_blank" class="btn btn-amber">
          <span>Amazon Books Search খুলুন</span> →
        </a>
      </div>

      <!-- Card 2: Interactive Sandbox -->
      <div class="card">
        <div>
          <div class="card-title">
            <span style="font-size: 22px;">💻</span> Interactive Simulator
          </div>
          <div class="card-desc">
            ব্রাউজারে এক্সটেনশন ইনস্টল না করেই লাইভ ইন্টারফেস দেখতে চান? এই সিমুলেটরে অ্যামাজন সার্চ রেজাল্ট এবং এক্সটেনশনের ৩৮০px রিয়েল সাইডবার ও স্কোর গজ টেস্ট করুন।
          </div>
        </div>
        <a href="/demo" target="_blank" class="btn btn-green">
          <span>লাইভ সিমুলেটর চালু করুন</span> ↗
        </a>
      </div>

      <!-- Card 3: Extension Settings/Options UI -->
      <div class="card">
        <div>
          <div class="card-title">
            <span style="font-size: 22px;">⚙️</span> Options & Settings UI
          </div>
          <div class="card-desc">
            এক্সটেনশনের সেটিংস পেজ (Gemini API কী, BSR থ্রেশহোল্ড, কারেন্সি রেট ও কাস্টমাইজেশন) সরাসরি ব্রাউজার ট্যাবে প্রিভিউ করুন।
          </div>
        </div>
        <a href="/extension/options.html" target="_blank" class="btn btn-primary">
          <span>Options UI খুলুন</span> ↗
        </a>
      </div>

      <!-- Card 4: Extension Popup UI -->
      <div class="card">
        <div>
          <div class="card-title">
            <span style="font-size: 22px;">📱</span> Popup Quick View
          </div>
          <div class="card-desc">
            ব্রাউজার টুলবারের আইকনে ক্লিক করলে যে পপআপ উইন্ডো (রিসার্চ হিস্ট্রি, ফেভারিট কিওয়ার্ড ও কুইক স্ট্যাটাস) দেখা যায় তা প্রিভিউ করুন।
          </div>
        </div>
        <a href="/extension/popup.html" target="_blank" class="btn btn-secondary">
          <span>Popup UI প্রিভিউ</span> ↗
        </a>
      </div>

      <!-- Card 5: Video Walkthrough -->
      <div class="card">
        <div>
          <div class="card-title">
            <span style="font-size: 22px;">🎬</span> Walkthrough Video
          </div>
          <div class="card-desc">
            এক্সটেনশনের সম্পূর্ণ কার্যপদ্ধতি ও ফিচারগুলোর অফিসিয়াল অ্যানিমেটেড ডেমো ভিডিও প্লেয়ার।
          </div>
        </div>
        <a href="/video" target="_blank" class="btn btn-secondary">
          <span>ভিডিও প্লেয়ার দেখুন</span> ↗
        </a>
      </div>

      <!-- Card 6: Download Zip -->
      <div class="card">
        <div>
          <div class="card-title">
            <span style="font-size: 22px;">📦</span> Extension ZIP Package
          </div>
          <div class="card-desc">
            Chrome Web Store-এ আপলোড করার জন্য সম্পূর্ণ প্রস্তুত প্রোডাকশন জিপ ফাইলটি ডাউনলোড করুন (v1.0.0)।
          </div>
        </div>
        <a href="/download/zip" class="btn btn-secondary">
          <span>Download v1.0.0 ZIP</span> ⬇
        </a>
      </div>
    </div>

    <!-- Step by Step Guide -->
    <div class="guide-box">
      <h2><span>📌</span> গুগল ক্রোমে এক্সটেনশনটি লোড করে অ্যামাজনে টেস্ট করার সহজ নিয়ম</h2>
      
      <div class="steps">
        <div class="step">
          <div class="step-num">১</div>
          <div class="step-content">
            গুগল ক্রোম ব্রাউজার খুলে নতুন ট্যাবে অ্যাড্রেস বারে লিখুন: <span class="code-pill">chrome://extensions</span> এবং এন্টার চাপুন।
          </div>
        </div>

        <div class="step">
          <div class="step-num">২</div>
          <div class="step-content">
            ক্রোম এক্সটেনশন পেজের উপরের ডান কোণে থাকা <strong>Developer mode</strong> টগলটি <strong>ON</strong> করুন।
          </div>
        </div>

        <div class="step">
          <div class="step-num">৩</div>
          <div class="step-content">
            উপরের বাম পাশে <strong>Load unpacked</strong> বাটনে ক্লিক করুন। নিচের ফোল্ডার পাথটি সিলেক্ট করুন:
            <div class="copy-box">
              <input type="text" id="folderPath" class="copy-input" readonly value="${path.join(__dirname, 'final build', '01_extension_package', 'kdp-niche-finder-v1.0.0-unpacked').replace(/\\/g, '\\\\')}">
              <button class="copy-btn" onclick="copyPath()">পাথ কপি করুন</button>
            </div>
          </div>
        </div>

        <div class="step">
          <div class="step-num">৪</div>
          <div class="step-content">
            এবার সরাসরি <a href="https://www.amazon.com/s?k=activity+book+for+kids&i=stripbooks" target="_blank" style="color: #38bdf8; text-decoration: underline; font-weight: 600;">Amazon Books Search</a> পেজ ওপেন করুন। সার্চ রেজাল্ট পেজ লোড হতেই এক্সটেনশন স্বয়ংক্রিয়ভাবে ডানপাশে নিশ রিসার্চ প্যানেল ওপেন করবে!
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="toast" class="toast">✓ ফোল্ডার পাথ কপি করা হয়েছে!</div>

  <script>
    function copyPath() {
      const input = document.getElementById('folderPath');
      navigator.clipboard.writeText(input.value).then(() => {
        const toast = document.getElementById('toast');
        toast.style.display = 'block';
        setTimeout(() => {
          toast.style.display = 'none';
        }, 2500);
      });
    }
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(dashboardHtml);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[KDP Niche Finder] Server is running live on http://localhost:${PORT}`);
});
