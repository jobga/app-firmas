/**
 * Fondo animado con Three.js: perros y gatos dibujados con una sola línea.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CAT_PATH, DOG_PATH } from './LineArt';

function parsePath(d: string): [number, number][] {
  const tk = d.match(/[MLC]|-?\d*\.?\d+/g) ?? [];
  let i = 0, cmd = 'M', x = 0, y = 0;
  const pts: [number, number][] = [];
  while (i < tk.length) {
    if (/[MLC]/.test(tk[i])) cmd = tk[i++];
    if (cmd === 'M' || cmd === 'L') {
      const nx = +tk[i++], ny = +tk[i++];
      if (cmd === 'L') for (let s = 1; s <= 10; s++) pts.push([x + (nx - x) * s / 10, y + (ny - y) * s / 10]);
      else pts.push([nx, ny]);
      x = nx; y = ny;
    } else {
      const [a, b, c, e, f, g] = [+tk[i++], +tk[i++], +tk[i++], +tk[i++], +tk[i++], +tk[i++]];
      for (let s = 1; s <= 24; s++) {
        const t = s / 24, u = 1 - t;
        pts.push([u * u * u * x + 3 * u * u * t * a + 3 * u * t * t * c + t * t * t * f, u * u * u * y + 3 * u * u * t * b + 3 * u * t * t * e + t * t * t * g]);
      }
      x = f; y = g;
    }
  }
  return pts;
}

const SPOTS: [number, number, number, number][] = [[-7, 3, -2, 1.3], [5.5, 4, -5, 1.1], [-3, -4, -6, 0.9], [8, -3, -3, 1.4], [0, 6, -8, 0.8], [-9, -5, -4, 1], [3, -1, -10, 1.2], [-5, 7, -9, 0.9], [9, 5, -7, 1]];
const COUNT = { subtle: 5, medium: 7, high: 9 } as const;
const OPACITY = { subtle: 0.14, medium: 0.2, high: 0.28 } as const;

export default function LineField({ animation, intensity, catColor, dogColor }: {
  animation: 'both' | 'cats' | 'dogs';
  intensity: 'subtle' | 'medium' | 'high';
  catColor: string;
  dogColor: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: el, alpha: true, antialias: true });
    } catch {
      return; // sin WebGL: el fondo queda liso
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.z = 14;
    const shapes = { cat: parsePath(CAT_PATH), dog: parsePath(DOG_PATH) };
    const kinds: ('cat' | 'dog')[] = animation === 'cats' ? ['cat'] : animation === 'dogs' ? ['dog'] : ['cat', 'dog'];

    const lines = SPOTS.slice(0, COUNT[intensity]).map((p, k) => {
      const kind = kinds[k % kinds.length];
      const src = shapes[kind];
      const arr = new Float32Array(src.length * 3);
      src.forEach((q, j) => { arr[j * 3] = (q[0] - 110) / 45; arr[j * 3 + 1] = -(q[1] - 110) / 45; arr[j * 3 + 2] = Math.sin(j * 0.05) * 0.25; });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.LineBasicMaterial({ color: kind === 'cat' ? catColor : dogColor, transparent: true, opacity: OPACITY[intensity] + 0.08 * (k % 3) });
      const line = new THREE.Line(geo, mat);
      line.position.set(p[0], p[1], p[2]);
      line.scale.setScalar(p[3]);
      line.userData = { n: src.length, off: k * 0.37, sp: 0.09 + (k % 3) * 0.02 };
      scene.add(line);
      return line;
    });

    const mouse = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => { mouse.x = e.clientX / window.innerWidth - 0.5; mouse.y = e.clientY / window.innerHeight - 0.5; };
    window.addEventListener('pointermove', onMove);
    const size = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w < 700 ? 60 : 40;
      camera.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let raf = 0;
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      lines.forEach((l, k) => {
        const u = l.userData as { n: number; off: number; sp: number };
        const ph = still ? 1 : (t * u.sp + u.off) % 1.5;
        l.geometry.setDrawRange(0, Math.max(2, Math.floor(Math.min(1, ph) * u.n)));
        if (!still) {
          l.rotation.y = Math.sin(t * 0.25 + k) * 0.5;
          l.rotation.z = Math.sin(t * 0.18 + k * 2) * 0.08;
        }
      });
      camera.position.x += (mouse.x * 2 - camera.position.x) * 0.04;
      camera.position.y += (-mouse.y * 1.5 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, -4);
      renderer.render(scene, camera);
      if (!still) raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      ro.disconnect();
      lines.forEach((l) => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); });
      renderer.dispose();
    };
  }, [animation, intensity, catColor, dogColor]);

  return <canvas ref={ref} aria-hidden="true" className="line-field" />;
}
