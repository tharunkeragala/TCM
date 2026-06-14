import { useEffect, useRef } from "react";

const PlexusBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const NODE_COUNT = 90;
    const MAX_DIST = 180;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() < 0.15 ? 2.2 : 1.1,
    }));

    const mouse = { x: -9999, y: -9999 };
    const onMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onMouseLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    const isDark = () => document.documentElement.classList.contains("dark");

    let animId: number;

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      const dark = isDark();

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = dark ? "#0d0b1a" : "#ffffff";
      ctx.fillRect(0, 0, W, H);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = dark
              ? `rgba(148, 103, 255, ${alpha})`
              : `rgba(3, 4, 94, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }

        const mx = nodes[i].x - mouse.x, my = nodes[i].y - mouse.y;
        const md = Math.sqrt(mx * mx + my * my);
        if (md < 140) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = dark
            ? `rgba(200, 160, 255, ${(1 - md / 140) * 0.75})`
            : `rgba(3, 4, 94, ${(1 - md / 140) * 0.6})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = dark
          ? (n.r > 1.5 ? "rgba(210, 180, 255, 0.9)" : "rgba(160, 120, 255, 0.75)")
          : (n.r > 1.5 ? "rgba(3, 4, 94, 0.9)"       : "rgba(3, 4, 94, 0.5)");
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
};

export default PlexusBackground;