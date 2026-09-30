// Adaptado de https://gist.github.com/peas/2f224fbb9674734315079eb70dae8f60
// Reusable "essay" Reel (1080x1920, 30 fps): archival photos with slow zoom, serif text revealed word by word.
// Each Reel is a list of scenes adapted faithfully from the post.
// Scene duration comes from the word count (~3 words/s reading speed).
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { backgroundVolume } from './music-volume.mjs';
import { signature } from './branding.mjs';
import { loadFont } from '@remotion/fonts';

loadFont({ family: 'SourceSerif', url: staticFile('fonts/ss-400.woff2'), weight: '400' });
loadFont({ family: 'SourceSerif', url: staticFile('fonts/ss-400i.woff2'), weight: '400', style: 'italic' });
loadFont({ family: 'SourceSerif', url: staticFile('fonts/ss-700.woff2'), weight: '700' });
loadFont({ family: 'InterUI', url: staticFile('fonts/inter-500.woff2'), weight: '500' });
loadFont({ family: 'InterUI', url: staticFile('fonts/inter-600.woff2'), weight: '600' });

export type Cena = {
  texto: string;
  kicker?: string;
  foto?: string; // file in public/fotos/
  pos?: string; // object-position of the photo
  cor?: boolean; // keep photo colors (default: black and white)
  destaque?: string; // words painted with the accent color
  tam?: number; // font size (default by length)
  italico?: boolean;
  dados?: { rotulo: string; valor: string; sobe?: boolean }[]; // "data" scene: rows with ↑ / ↓ (no `sobe` = neutral bar)
  figura?: string; // contained image above the text (screenshot, diagram), file in public/fotos/
  figPos?: string; // object-position inside the figure box
  figAlt?: number; // figure box height (default 620)
  rodape?: string;
  dur?: number; // frames; default from word count
};

export type Paleta = { fundo: string; acento: string; texto?: string };

const palavras = (s: string) => s.split(/\s+/).filter(Boolean);
export const duracaoCena = (c: Cena) => {
  if (c.dur) return c.dur;
  const n = palavras(c.texto).length + (c.dados ? c.dados.length * 5 : 0);
  return Math.round(Math.max(3.8, n / 3 + 1.6) * 30);
};
export const duracaoTotal = (cenas: Cena[]) => cenas.reduce((s, c) => s + duracaoCena(c), 0);

const tamanhoPadrao = (c: Cena) => {
  const n = palavras(c.texto).length;
  const byWords = n <= 6 ? 112 : n <= 12 ? 88 : n <= 18 ? 72 : 62;
  return Math.min(byWords, c.texto.length > 80 ? 62 : 112);
};

const Palavras: React.FC<{ c: Cena; dur: number; acento: string }> = ({ c, dur, acento }) => {
  const f = useCurrentFrame();
  const ws = palavras(c.texto);
  const passo = Math.min(5, (dur * 0.35) / ws.length); // every word in by ~1/3 of the scene
  const dest = new Set(palavras(c.destaque ?? ''));
  const tam = c.tam ?? tamanhoPadrao(c);
  return (
    <div style={{ fontFamily: 'SourceSerif', fontWeight: c.italico ? 400 : 700, fontStyle: c.italico ? 'italic' : 'normal', fontSize: tam, lineHeight: 1.14, color: 'inherit', letterSpacing: '-0.01em' }}>
      {ws.map((p, i) => {
        const o = interpolate(f - 8 - i * passo, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <span key={i} style={{ opacity: o, display: 'inline-block', transform: `translateY(${interpolate(o, [0, 1], [18, 0])}px)`, marginRight: '0.26em', maxWidth: '100%', overflowWrap: 'anywhere', color: dest.has(p) ? acento : undefined }}>{p}</span>
        );
      })}
    </div>
  );
};

const Dados: React.FC<{ c: Cena; acento: string }> = ({ c, acento }) => {
  const f = useCurrentFrame();
  const inicio = 8 + palavras(c.texto).length * 5;
  return (
    <div style={{ marginTop: 70 }}>
      {c.dados!.map((d, i) => {
        const o = interpolate(f - inicio - i * 30, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <div key={i} style={{ opacity: o, transform: `translateX(${interpolate(o, [0, 1], [-40, 0])}px)`, display: 'flex', alignItems: 'center', gap: 40, padding: '34px 0', borderTop: '2px solid currentColor' }}>
            {d.sobe === undefined ? (
              <div style={{ flex: 'none', width: 12, alignSelf: 'stretch', background: acento, borderRadius: 6, marginRight: 20 }} />
            ) : (
              <svg width="96" height="120" viewBox="0 0 24 30" style={{ flex: 'none', transform: d.sobe ? undefined : 'rotate(180deg)' }}>
                <path d="M12 2 L22 14 H15 V28 H9 V14 H2 Z" fill={d.sobe ? acento : '#E4675A'} />
              </svg>
            )}
            <span>
              <div style={{ fontFamily: 'InterUI', fontWeight: 600, fontSize: 80, lineHeight: 1.1, color: 'inherit' }}>{d.valor}</div>
              <div style={{ fontFamily: 'InterUI', fontWeight: 500, fontSize: 50, color: 'inherit', marginTop: 10 }}>{d.rotulo}</div>
            </span>
          </div>
        );
      })}
    </div>
  );
};

const CenaView: React.FC<{ c: Cena; dur: number; paleta: Paleta }> = ({ c, dur, paleta }) => {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, dur], [1.04, 1.16]);
  const fade = interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: paleta.fundo, opacity: fade }}>
      {c.foto && (
        <>
          <Img src={staticFile(`fotos/${c.foto}`)} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', objectPosition: c.pos, transform: `scale(${zoom})`, filter: c.cor === true ? 'saturate(.65)' : 'grayscale(1)' }} />
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.08) 15%, rgba(0,0,0,.65) 52%, rgba(0,0,0,.94) 100%)' }} />
        </>
      )}
      {/* content between y=250 and y=1500 (Reels UI safe zone), right margin 170 */}
      <div style={{ position: 'absolute', left: 96, right: 170, color: c.foto ? '#F3EFE5' : paleta.texto ?? '#191814', top: c.foto ? 880 : c.figura ? 300 : c.dados ? 400 : 620 }}>
        {c.figura && (
          <div style={{ height: c.figAlt ?? 620, marginBottom: 60, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,.15)', opacity: interpolate(f, [4, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), transform: `scale(${interpolate(f, [0, dur], [1, 1.03])})` }}>
            <Img src={staticFile(`fotos/${c.figura}`)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: c.figPos ?? '50% 50%' }} />
          </div>
        )}
        {c.kicker && <div style={{ fontFamily: 'InterUI', fontWeight: 600, fontSize: 32, letterSpacing: '0.14em', color: c.foto ? '#D1B894' : paleta.acento, marginBottom: 30 }}>{c.kicker}</div>}
        <Palavras c={c} dur={dur} acento={c.foto ? '#D1B894' : paleta.acento} />
        {c.dados && <Dados c={c} acento={c.foto ? '#D1B894' : paleta.acento} />}
        {c.rodape && <div style={{ fontFamily: 'InterUI', fontWeight: 500, fontSize: 42, color: 'inherit', marginTop: 70, opacity: interpolate(f, [50, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{c.rodape}</div>}
      </div>
    </AbsoluteFill>
  );
};

export type EnsaioProps = { cenas: Cena[]; paleta: Paleta; musica?: string; volume?: number };

export const Ensaio: React.FC<EnsaioProps> = ({ cenas, paleta, musica, volume = 0.18 }) => {
  const total = duracaoTotal(cenas);
  const frame = useCurrentFrame();
  let ini = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: paleta.fundo }}>
      {cenas.map((c, i) => {
        const dur = duracaoCena(c);
        const from = ini;
        ini += dur;
        return <Sequence key={i} from={from} durationInFrames={dur}><CenaView c={c} dur={dur} paleta={paleta} /></Sequence>;
      })}
      {/* Outside scene fades: attribution stays visible even on transition frames. */}
      <div style={{ position: 'absolute', right: 170, bottom: 340, zIndex: 1,
        fontFamily: 'InterUI', fontWeight: 500, fontSize: 28, lineHeight: 1.4,
        whiteSpace: 'nowrap', textAlign: 'right', color: '#F3EFE5',
        backgroundColor: '#191814', padding: '8px 12px' }}>{signature}</div>
      {musica && <Audio src={staticFile(musica)} loop volume={backgroundVolume(frame, total, volume)} />}
    </AbsoluteFill>
  );
};
