import { Composition, registerRoot } from 'remotion';
import { Ensaio, duracaoTotal } from './Ensaio';

const defaults = { cenas: [{ texto: 'Seu post aqui.' }], paleta: { fundo: '#E5EDFF', acento: '#355BBC', texto: '#22345A' } };
const Root = () => <Composition id="Reel" component={Ensaio} width={1080} height={1920} fps={30}
  durationInFrames={114} defaultProps={defaults}
  calculateMetadata={({ props }) => ({ durationInFrames: duracaoTotal(props.cenas) })} />;
registerRoot(Root);
