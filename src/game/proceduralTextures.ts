import * as THREE from 'three';

/**
 * Procedural Cartoon Textures Generator for Office Environment
 * Generates rich stylized textures using HTML5 Canvas with proper SRGBColorSpace and anisotropy
 */

function createCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

// 1. Stylized Office Carpet Texture (checkered corporate tiles with cartoon stitch borders)
export function createCarpetTexture(theme: 'slate' | 'navy' | 'burgundy' = 'slate'): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx) => {
    let colors = ['#1e293b', '#334155', '#1e293b', '#283548'];
    if (theme === 'navy') {
      colors = ['#0f172a', '#1e3a8a', '#172554', '#1e293b'];
    } else if (theme === 'burgundy') {
      colors = ['#450a0a', '#7f1d1d', '#3e1111', '#5c1414'];
    }
    const tileSize = 256;

    for (let y = 0; y < 512; y += tileSize) {
      for (let x = 0; x < 512; x += tileSize) {
        const index = ((x / tileSize) + (y / tileSize)) % colors.length;
        ctx.fillStyle = colors[index];
        ctx.fillRect(x, y, tileSize, tileSize);

        // Tile border
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 6;
        ctx.strokeRect(x + 3, y + 3, tileSize - 6, tileSize - 6);

        // Micro dot weave
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        for (let dy = 16; dy < tileSize; dy += 24) {
          for (let dx = 16; dx < tileSize; dx += 24) {
            ctx.beginPath();
            ctx.arc(x + dx, y + dy, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }, 8, 8);
}

// 2. Stylized Wood Veneer for Desks (warm oak with cartoon grain lines)
export function createWoodTexture(isDark: boolean = false): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = isDark ? '#3e1f0e' : '#b45309';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = isDark ? '#241006' : '#78350f';
    ctx.lineWidth = 4;
    for (let y = 0; y < 512; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y + (Math.sin(y * 0.1) * 6));
      ctx.bezierCurveTo(
        150, y + Math.sin(y) * 12,
        350, y - Math.sin(y * 0.5) * 12,
        512, y + Math.cos(y * 0.08) * 8
      );
      ctx.stroke();
    }

    ctx.strokeStyle = isDark ? '#5c2d16' : '#f59e0b';
    ctx.lineWidth = 2;
    for (let y = 16; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
  });
}

// 3. Acoustic Ceiling Grid Texture with Stylized Fluorescent Lamps
export function createCeilingTexture(): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, 512, 512);
    ctx.strokeRect(0, 0, 256, 256);
    ctx.strokeRect(256, 0, 256, 256);
    ctx.strokeRect(0, 256, 256, 256);
    ctx.strokeRect(256, 256, 256, 256);

    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      ctx.fillRect(rx, ry, 2, 2);
    }
  }, 6, 6);
}

// 4. Computer Screen Display (IDE Code, Financial Charts, Reddit, Warning)
export function createScreenTexture(type: 'code' | 'chart' | 'warning' | 'reddit'): THREE.CanvasTexture {
  return createCanvasTexture(512, 256, (ctx) => {
    if (type === 'code') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 512, 256);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 512, 32);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(16, 16, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eab308';
      ctx.beginPath(); ctx.arc(32, 16, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(48, 16, 5, 0, Math.PI * 2); ctx.fill();

      const colors = ['#38bdf8', '#a855f7', '#4ade80', '#f43f5e', '#facc15'];
      for (let line = 0; line < 12; line++) {
        const y = 50 + line * 16;
        let x = 20;
        const indent = (line % 3 === 0) ? 0 : 30;
        x += indent;
        const segments = Math.floor(Math.random() * 4) + 2;
        for (let s = 0; s < segments; s++) {
          const width = 20 + Math.random() * 60;
          ctx.fillStyle = colors[(line + s) % colors.length];
          ctx.fillRect(x, y, width, 8);
          x += width + 10;
        }
      }
    } else if (type === 'chart') {
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#047857';
      ctx.fillRect(0, 0, 512, 30);

      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      for (let x = 0; x < 512; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, 256); ctx.stroke();
      }
      for (let y = 30; y < 256; y += 22) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      }

      ctx.fillStyle = '#34d399';
      ctx.fillRect(360, 180, 20, 60);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(390, 140, 20, 100);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(420, 200, 20, 40);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(450, 110, 20, 130);
    } else if (type === 'reddit') {
      ctx.fillStyle = '#ff4500';
      ctx.fillRect(0, 0, 512, 35);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('MEMES & CATS - r/workreform', 20, 24);

      ctx.fillStyle = '#1a1a1b';
      ctx.fillRect(0, 35, 512, 221);

      ctx.fillStyle = '#272729';
      ctx.fillRect(20, 50, 472, 80);
      ctx.fillRect(20, 145, 472, 90);

      ctx.fillStyle = '#d7dadc';
      ctx.font = '14px sans-serif';
      ctx.fillText('Como fingir que está trabalhando quando o chefe passa', 40, 75);
      ctx.fillText('Dica 1: Olhe fixamente para a tela com cara de dúvida.', 40, 95);
    } else {
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(0, 0, 512, 256);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('! ACESSO RESTRITO !', 120, 70);
      ctx.font = '16px monospace';
      ctx.fillText('COPIANDO DADOS CONFIDENCIAIS...', 110, 120);
      ctx.fillText('BYPASS FIREWALL: 84%', 150, 150);

      ctx.strokeStyle = '#ef4444';
      ctx.strokeRect(100, 170, 312, 24);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(102, 172, 260, 20);
    }
  });
}

// 5. Stylized Window with Cartoon City Skyline (creates high depth immersion)
export function createWindowSkylineTexture(): THREE.CanvasTexture {
  return createCanvasTexture(1024, 512, (ctx) => {
    // Sunset / Dusk gradient sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(0.5, '#1e1b4b');
    skyGrad.addColorStop(1, '#831843');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // Glowing sun on horizon
    ctx.fillStyle = 'rgba(251, 146, 60, 0.4)';
    ctx.beginPath();
    ctx.arc(512, 400, 140, 0, Math.PI * 2);
    ctx.fill();

    // Cartoon Skyscraper Silhouettes
    const buildings = [
      { x: 30, w: 90, h: 320 },
      { x: 130, w: 120, h: 420 },
      { x: 260, w: 110, h: 280 },
      { x: 380, w: 140, h: 480 },
      { x: 530, w: 100, h: 360 },
      { x: 640, w: 130, h: 440 },
      { x: 780, w: 110, h: 300 },
      { x: 900, w: 100, h: 380 },
    ];

    buildings.forEach((b) => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(b.x, 512 - b.h, b.w, b.h);

      // Windows
      ctx.fillStyle = '#fef08a';
      for (let wy = 512 - b.h + 20; wy < 500; wy += 24) {
        for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 20) {
          if (Math.random() > 0.4) {
            ctx.fillRect(wx, wy, 8, 12);
          }
        }
      }
    });

    // Window pane mullions
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 12;
    ctx.strokeRect(0, 0, 1024, 512);
    ctx.beginPath();
    ctx.moveTo(341, 0); ctx.lineTo(341, 512);
    ctx.moveTo(682, 0); ctx.lineTo(682, 512);
    ctx.moveTo(0, 256); ctx.lineTo(1024, 256);
    ctx.stroke();
  });
}

// 6. Modern Framed Corporate Artwork
export function createAbstractArtTexture(seed: number = 1): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx) => {
    // Matte border
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(24, 24, 464, 464);

    // Bauhaus / Minimalist shapes
    const colors = ['#e11d48', '#2563eb', '#f59e0b', '#0d9488'];
    ctx.fillStyle = colors[seed % colors.length];
    ctx.beginPath();
    ctx.arc(200, 200, 110, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors[(seed + 1) % colors.length];
    ctx.fillRect(220, 220, 160, 160);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(80, 400);
    ctx.lineTo(420, 120);
    ctx.stroke();
  });
}

// 7. Motivational Posters
export function createPosterTexture(title: string, subtitle: string, color: string): THREE.CanvasTexture {
  return createCanvasTexture(512, 384, (ctx) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 384);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(16, 16, 480, 352);

    ctx.fillStyle = color;
    ctx.fillRect(32, 32, 448, 220);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(256, 130, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(256, 100);
    ctx.lineTo(285, 155);
    ctx.lineTo(227, 155);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Impact", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title.toUpperCase(), 256, 300);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 18px "Georgia", serif';
    ctx.fillText(`"${subtitle}"`, 256, 335);
  });
}

// 8. Whiteboard
export function createWhiteboardTexture(): THREE.CanvasTexture {
  return createCanvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 12;
    ctx.strokeRect(0, 0, 512, 256);

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 50, 100, 50);
    ctx.strokeRect(200, 50, 110, 50);
    ctx.strokeRect(360, 50, 110, 50);

    ctx.beginPath();
    ctx.moveTo(140, 75); ctx.lineTo(200, 75);
    ctx.moveTo(310, 75); ctx.lineTo(360, 75);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px "Comic Sans MS", cursive, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LUCRO Q4', 90, 80);
    ctx.fillText('META 200%', 255, 80);
    ctx.fillText('BÔNUS??', 415, 80);

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(255, 80, 70, 35, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(100, 116, 139, 0.08)';
    ctx.fillRect(100, 150, 300, 60);
  });
}

// 9. Stylized Corporate Wall Texture (Plaster panels with subtle acoustic seams & baseboard trim)
export function createCorporateWallTexture(theme: 'modern_tech' | 'corporate_law' | 'fintech' = 'modern_tech'): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx) => {
    const baseColor = theme === 'corporate_law' ? '#fdf2f2' : (theme === 'fintech' ? '#f8fafc' : '#f1f5f9');
    const shadowColor = theme === 'corporate_law' ? '#eedada' : '#e2e8f0';
    const trimColor = theme === 'corporate_law' ? '#3e1a14' : '#1e293b';

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle wall panel seams
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 3;
    for (let x = 0; x <= 512; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }

    // Micro-speckle plaster texture
    ctx.fillStyle = 'rgba(15, 23, 42, 0.025)';
    for (let y = 0; y < 512; y += 16) {
      for (let x = 0; x < 512; x += 16) {
        if ((x + y) % 32 === 0) {
          ctx.fillRect(x + 2, y + 2, 2, 2);
        }
      }
    }

    // Baseboard Skirting Trim along the bottom
    ctx.fillStyle = trimColor;
    ctx.fillRect(0, 476, 512, 36);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, 476, 512, 3);
  }, 4, 1);
}

// 10. Heavy Industrial Wall Texture for Substation & Generator Room (Floor 2)
export function createIndustrialWallTexture(): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx) => {
    // Reinforced steel/concrete panel background
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 512, 512);

    // Metal panel bevel borders
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 500);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 492, 492);

    // Rivets / Industrial Bolts in the corners and edges
    const drawBolt = (bx: number, by: number) => {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(bx - 1, by - 1, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    drawBolt(24, 24);
    drawBolt(488, 24);
    drawBolt(24, 440);
    drawBolt(488, 440);
    drawBolt(256, 24);
    drawBolt(256, 440);

    // Subtle brushed metal streaks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let y = 30; y < 450; y += 12) {
      ctx.beginPath();
      ctx.moveTo(15, y);
      ctx.lineTo(497, y);
      ctx.stroke();
    }

    // Hazard Safety Striping (Yellow & Black diagonal warning bands along bottom)
    const stripeY = 460;
    const stripeH = 52;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, stripeY, 512, stripeH);

    ctx.fillStyle = '#eab308';
    for (let sx = -60; sx < 550; sx += 44) {
      ctx.beginPath();
      ctx.moveTo(sx, stripeY + stripeH);
      ctx.lineTo(sx + 24, stripeY);
      ctx.lineTo(sx + 44, stripeY);
      ctx.lineTo(sx + 20, stripeY + stripeH);
      ctx.closePath();
      ctx.fill();
    }

    // Top border of safety stripe
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, stripeY, 512, 3);
  }, 3, 1);
}

// 11. Glossy Ceramic Tile Wall Texture for Breakroom
export function createBreakroomTileTexture(): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#cbd5e1'; // Grout color
    ctx.fillRect(0, 0, 512, 512);

    const tileW = 124;
    const tileH = 60;
    const gap = 4;

    for (let row = 0; row < 9; row++) {
      const offsetX = (row % 2 === 1) ? -(tileW / 2) : 0;
      for (let col = -1; col < 6; col++) {
        const tx = col * (tileW + gap) + offsetX;
        const ty = row * (tileH + gap);

        // Tile base
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(tx, ty, tileW, tileH);

        // Bevel highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tx + 2, ty + 2, tileW - 4, 3);
        ctx.fillRect(tx + 2, ty + 2, 3, tileH - 4);

        // Subtle tile shadow
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(tx + 2, ty + tileH - 3, tileW - 4, 2);
        ctx.fillRect(tx + tileW - 3, ty + 2, 2, tileH - 4);
      }
    }
  }, 4, 2);
}
