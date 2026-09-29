"use client";

import type { Bubble, Panel } from "./types";

const PAGE_W = 1000;
const PAGE_H = 1414;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawBubble(ctx: CanvasRenderingContext2D, b: Bubble, panelRect: { x: number; y: number; w: number; h: number }, scale: number) {
  const bx = panelRect.x + (b.x / 100) * panelRect.w;
  const by = panelRect.y + (b.y / 100) * panelRect.h;
  const maxW = (b.w / 100) * panelRect.w;

  if (b.kind === "sfx") {
    const fontSize = Math.max(18, 30 * (b.size || 1));
    ctx.font = `900 italic ${fontSize}px sans-serif`;
    ctx.textAlign = b.align === "center" ? "center" : b.align === "right" ? "right" : "left";
    ctx.lineWidth = fontSize * 0.14;
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#fff";
    ctx.lineJoin = "round";
    const tx = b.align === "center" ? bx + maxW / 2 : b.align === "right" ? bx + maxW : bx;
    ctx.strokeText(b.text, tx, by + fontSize);
    ctx.fillText(b.text, tx, by + fontSize);
    return;
  }

  const fontSize = Math.max(11, 13 * (b.size || 1)) * scale;
  ctx.font = `${b.kind === "shout" ? "800 italic" : "500"} ${fontSize}px sans-serif`;
  const pad = fontSize * 0.6;
  const lines = wrapText(ctx, b.text, maxW - pad * 2);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const boxW = Math.min(maxW, textW + pad * 2);
  const boxH = lines.length * fontSize * 1.2 + pad * 1.4;

  ctx.save();
  if (b.kind === "narration") {
    ctx.fillStyle = "#f5f0e6"; ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5;
  } else if (b.kind === "caption") {
    ctx.fillStyle = "#111"; ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5;
  } else {
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
  }
  const r = b.kind === "speech" || b.kind === "shout" || b.kind === "thought" ? fontSize * 0.5 : 2;
  roundRect(ctx, bx, by, boxW, boxH, r);
  ctx.fill();
  ctx.stroke();

  // tail
  if (b.tail && b.tail !== "none" && (b.kind === "speech" || b.kind === "shout" || b.kind === "whisper")) {
    const tailW = fontSize * 0.7, tailH = fontSize * 0.9;
    ctx.beginPath();
    if (b.tail === "bl") { ctx.moveTo(bx + boxW * 0.16, by + boxH - 1); ctx.lineTo(bx + boxW * 0.16 + tailW, by + boxH - 1); ctx.lineTo(bx + boxW * 0.16 + tailW * 0.3, by + boxH + tailH); }
    if (b.tail === "br") { ctx.moveTo(bx + boxW * 0.84 - tailW, by + boxH - 1); ctx.lineTo(bx + boxW * 0.84, by + boxH - 1); ctx.lineTo(bx + boxW * 0.84 - tailW * 0.3, by + boxH + tailH); }
    if (b.tail === "tl") { ctx.moveTo(bx + boxW * 0.16, by + 1); ctx.lineTo(bx + boxW * 0.16 + tailW, by + 1); ctx.lineTo(bx + boxW * 0.16 + tailW * 0.3, by - tailH); }
    if (b.tail === "tr") { ctx.moveTo(bx + boxW * 0.84 - tailW, by + 1); ctx.lineTo(bx + boxW * 0.84, by + 1); ctx.lineTo(bx + boxW * 0.84 - tailW * 0.3, by - tailH); }
    ctx.closePath();
    ctx.fillStyle = ctx.fillStyle as string;
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.stroke();
  }

  ctx.fillStyle = b.kind === "caption" ? "#fff" : "#111";
  ctx.textAlign = b.align === "center" ? "center" : b.align === "right" ? "right" : "left";
  const tx = b.align === "center" ? bx + boxW / 2 : b.align === "right" ? bx + boxW - pad : bx + pad;
  lines.forEach((line, i) => {
    ctx.fillText(line, tx, by + pad * 0.9 + fontSize * (i + 0.8));
  });
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Render a full manga page (panels + bubbles) into a canvas. */
export async function renderPageCanvas(panels: Panel[], opts?: { width?: number }): Promise<HTMLCanvasElement> {
  const scale = (opts?.width ?? PAGE_W) / PAGE_W;
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W * scale;
  canvas.height = PAGE_H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fafaf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);

  const sorted = [...panels].sort((a, b) => a.order - b.order);
  for (const p of sorted) {
    const rect = { x: (p.x / 100) * PAGE_W, y: (p.y / 100) * PAGE_H, w: (p.w / 100) * PAGE_W, h: (p.h / 100) * PAGE_H };
    if (p.imageUrl) {
      try {
        const img = await loadImage(p.imageUrl);
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.clip();
        drawCover(ctx, img, rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
      } catch { /* missing image: leave blank */ }
    } else {
      ctx.save();
      ctx.fillStyle = "#e8e6e0";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = "#8a877e";
      ctx.font = "500 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.description ? "panel pending generation" : "empty panel", rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.restore();
    }
    ctx.strokeStyle = "#0a0a0e";
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    for (const b of p.bubbles) drawBubble(ctx, b, rect, 1);
  }
  return canvas;
}
