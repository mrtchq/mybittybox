import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

/**
 * BittyLottie — theme-consistent splash animation loader.
 *
 * Wires the 5 brand .lottie files in /public/splash into the SPA.
 * We self-parse the dotLottie archive (manifest.json -> animations/<id>.json)
 * and feed the Lottie JSON to lottie-react. This avoids the extra
 * @lottiefiles/dotlottie-react dependency and keeps the asset pipeline
 * fully owned in code (the .lottie files are built by
 * /root/bittybox-lottie-proof/build_lotties.py).
 *
 * Brand: cyan #00F0FF / fuchsia #FF00E5 / holographic, Orbitron.
 */

export type BittyLottieName =
  | 'logo-ceremony'
  | 'lock-lab-25'
  | 'hero-reveal'
  | 'cta-glow-loop'
  | 'encoding-loader';

interface BittyLottieProps {
  name: BittyLottieName;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** force a fixed pixel size (player scales via CSS anyway) */
  speed?: number;
  onLoaded?: () => void;
}

async function loadLottieData(name: BittyLottieName): Promise<unknown | null> {
  try {
    const res = await fetch(`/splash/${name}.lottie`);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Minimal unzip of the single animation member we need.
    // dotLottie layout: manifest.json + animations/<id>.json
    const view = new DataView(buf);
    // ZIP: scan for the local-file header signature 0x04034b50 and read names.
    const files: Record<string, Uint8Array> = {};
    let off = 0;
    const bytes = new Uint8Array(buf);
    while (off + 4 <= bytes.length) {
      const sig = view.getUint32(off, true);
      if (sig !== 0x04034b50) {
        off += 1;
        continue;
      }
      const method = view.getUint16(off + 8, true);
      const compSize = view.getUint32(off + 18, true);
      const uncompSize = view.getUint32(off + 22, true);
      const nameLen = view.getUint16(off + 26, true);
      const extraLen = view.getUint16(off + 28, true);
      const fname = new TextDecoder().decode(bytes.subarray(off + 30, off + 30 + nameLen));
      let dataStart = off + 30 + nameLen + extraLen;
      const comp = bytes.subarray(dataStart, dataStart + compSize);
      if (method === 0) {
        files[fname] = comp;
      } else if (method === 8) {
        // inflate via DecompressionStream (available in modern browsers)
        const ds = new (window as unknown as { DecompressionStream: typeof DecompressionStream }).DecompressionStream('deflate-raw');
        const stream = new Response(comp).body!.pipeThrough(ds);
        const ab = await new Response(stream).arrayBuffer();
        files[fname] = new Uint8Array(ab);
      }
      if (fname === `animations/${name}.json`) {
        return JSON.parse(new TextDecoder().decode(files[fname]));
      }
      // advance: compressed data + (if method 8 we already read uncompSize via stream,
      // but fall back to compSize for offset safety)
      off = dataStart + (method === 8 ? uncompSize : compSize);
      if (fname.startsWith('animations/') && fname.endsWith('.json')) {
        // found a member; if it's ours we returned already
      }
    }
    // fallback: if exact id not matched, return first animations/*.json
    const first = Object.keys(files).find((k) => k.startsWith('animations/') && k.endsWith('.json'));
    return first ? JSON.parse(new TextDecoder().decode(files[first])) : null;
  } catch {
    return null;
  }
}

export const BittyLottie: React.FC<BittyLottieProps> = ({
  name,
  loop = true,
  autoplay = true,
  className,
  style,
  speed = 1,
  onLoaded,
}) => {
  const [data, setData] = useState<unknown | null>(null);

  useEffect(() => {
    let alive = true;
    loadLottieData(name).then((d) => {
      if (alive && d) {
        setData(d);
        onLoaded?.();
      }
    });
    return () => {
      alive = false;
    };
  }, [name, onLoaded]);

  if (!data) return null; // gracefully absent until loaded (no layout shift)

  return (
    <div
      className={className}
      style={style}
      aria-hidden="true"
      role="presentation"
    >
      <Lottie
        animationData={data as object}
        loop={loop}
        autoplay={autoplay}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default BittyLottie;
