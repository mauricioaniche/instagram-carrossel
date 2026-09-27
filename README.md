# Instagram Carrossel

O usuário envia **texto ou JSON por esta conversa**. O agente organiza os posts, prepara as entradas do gerador e entrega carrosséis, reels, capas e legendas. As regras desse atendimento estão em [AGENTS.md](AGENTS.md).

Internamente, o gerador de terminal recebe um `.txt` por post, chama o **Codex CLI para selecionar as ideias principais** e renderiza um carrossel de PNGs **1080 × 1350**, um reel MP4 H.264 **1080 × 1920 / 30 fps** e sua capa.

Adaptado do [gist de Paulo Silveira (peas)](https://gist.github.com/peas/2f224fbb9674734315079eb70dae8f60): usa o motor Remotion `Ensaio`, a base visual original, com regras editoriais próprias para adaptar o texto do autor com fidelidade. A etapa editorial agora acontece automaticamente via Codex, antes da renderização. Projeto independente para gerar mídia local.

## Instalação

Node.js 22 ou superior. O [Codex CLI](https://developers.openai.com/codex/cli) já faz parte das dependências do gerador, com versão fixada:

```bash
cd ~/workspace/instagram-carrossel
npm ci
npx codex login
npm run setup
```

A etapa editorial e a revisão visual usam o Codex autenticado. As fotos devem ser reais, gratuitas e escolhidas no Unsplash; não há geração de imagens nem necessidade de chave da API de imagens.

O setup baixa o Chromium para Playwright e Remotion. Se ele estiver ausente, o gerador tenta usar o Chrome instalado nos caminhos comuns de macOS/Linux. Também aceita `--browser "/caminho/do/chrome"`. Em Linux, se faltarem bibliotecas, execute `npx playwright install --with-deps chromium`.

## Entrada pela conversa

Envie o texto de um post ou um JSON com vários textos, colado ou anexado. Por padrão, o agente prepara os dois formatos para cada post; você pode indicar um formato ou um subconjunto do lote. Não é necessário converter o conteúdo em arquivos `.txt`.

Para **texto individual**, o agente primeiro apresenta aqui o texto completo da capa e de cada slide, em ordem, com a frase principal e o apoio separados, e pede sua aprovação. Você pode ajustar a redação quantas vezes precisar: a versão atualizada é reapresentada antes da geração. A busca de fotos e a geração do carrossel, da capa e do reel só começam depois da aprovação explícita, salvo se você dispensar essa revisão. O pedido inicial para gerar não aprova automaticamente o texto que ainda será proposto.

O carrossel deve usar exatamente o texto e a ordem aprovados; o reel recebe uma adaptação mais curta que incorpora suas correções. Se for necessário mudar a redação ou a organização do carrossel, o agente pede nova aprovação. Essa etapa pertence ao atendimento pela conversa: a CLI não tem confirmação interativa nem opção de carregar um roteiro aprovado. Como cada execução refaz a seleção editorial, o agente deve preservar a versão aprovada ao preparar a renderização com os módulos do projeto, sem substituí-la por uma nova seleção automática.

O agente inspeciona os campos reais do JSON, preserva a ordem e os IDs e mantém os comentários associados aos respectivos posts. Campos ambíguos precisam ser esclarecidos; não há um esquema de JSON obrigatório para o atendimento pela conversa. Para lotes, a entrega inclui um índice com os arquivos e as pendências de cada post. A geração local não publica no Instagram.

Lotes JSON seguem o fluxo de geração por lote, sem essa pausa obrigatória, a menos que você peça para revisar os textos antes.

## Gerar pelo terminal

Esta seção documenta a ferramenta usada pelo agente e também permite execução manual. A CLI aceita **um arquivo `.txt` com o texto de um único post**. Ela não importa diretamente JSON: o agente prepara um `.txt` por post e mantém comentários e metadados separados.

1. Salve o texto do post em `meu-post.txt`, em UTF-8, com os parágrafos habituais. Por exemplo:

   ```text
   Código bom começa com decisões claras.

   Antes de pedir para uma IA implementar uma funcionalidade, descreva o problema e os critérios de aceitação.

   Depois, revise o resultado e verifique se a solução continua fácil de entender e manter.
   ```

2. Dentro de `~/workspace/instagram-carrossel/`, execute:

   ```bash
   npm run generate -- /caminho/meu-post.txt --image foto.jpg --image-url https://unsplash.com/photos/ID-DA-FOTO
   ```

O comando envia o post ao Codex, adapta as ideias principais e gera o carrossel e o reel na mesma execução. As imagens mostram o conteúdo selecionado, sem “Ensaio”, “Continue a leitura”, assinatura do autor do perfil ou contador de página. Atribuições a pessoas citadas no post podem aparecer na capa. Isso também vale para a capa do reel.

Para testar com o exemplo incluído ou escolher a pasta de saída:

```bash
npm run generate -- examples/post.txt --image foto.jpg --image-url https://unsplash.com/photos/ID-DA-FOTO
npm run generate -- /caminho/meu-post.txt --image foto.jpg --image-url https://unsplash.com/photos/ID-DA-FOTO --out ./out/meu-post
```

Para conferir apenas o roteiro de IA antes de gerar mídia:

```bash
npm run generate -- /caminho/meu-post.txt --plan-only
```

Cada execução faz uma nova seleção com IA; `--plan-only` não reutiliza o roteiro em uma chamada posterior.

De qualquer diretório:

```bash
node /caminho/instagram-carrossel/generate.mjs /caminho/meu-post.txt --image foto.jpg --image-url https://unsplash.com/photos/ID-DA-FOTO
```

Caminhos relativos de entrada e saída são relativos ao diretório da chamada. Use aspas em caminhos com espaços. Para processar vários posts, salve cada um em seu próprio `.txt` e execute o comando uma vez por arquivo, usando pastas de saída diferentes.

Opções:

- `--image foto.jpg`: foto real gratuita baixada do Unsplash (JPEG ou PNG).
- `--image-url https://unsplash.com/photos/...`: página da foto selecionada para crédito; não use a URL da busca ou do arquivo de imagem.
- `--music nome.mp3`: escolhe uma faixa da pasta `music/` do projeto. Sem essa opção, o gerador escolhe uma automaticamente.
- `--model nome`: escolhe o modelo usado por `codex exec`; sem isso, usa a configuração do Codex.
- `--codex /caminho/codex`: executável alternativo; por padrão usa a versão local instalada por `npm ci`, inclusive ao chamar `node generate.mjs` de outro diretório.
- `--plan-only`: chama o Codex e salva apenas o roteiro, sem abrir navegador ou renderizar mídia.
- `--out pasta-nova`: destino. A pasta final não pode existir, para não sobrescrever arquivos.
- `--browser /caminho/chrome`: navegador para renderização.

Sem `--out`, cada execução cria `out/<nome>-<timestamp>/`.

```text
out/<nome>-<timestamp>/
  carrossel/01.png ...       # capa e slides; só os arquivos são numerados
  reel.mp4                  # texto animado com música de fundo
  capa-reel.png             # capa própria do reel
  musica.json               # faixa usada, volume e fades
  carrossel.html            # prévia com fontes embutidas
  fotos/editorial.jpg       # foto aprovada (ou .png)
  avaliacoes-fotos.json    # aprovação, notas e motivos
  roteiro.json              # texto de origem e seleção validada da IA
  prompt.txt                # instruções editoriais e texto enviados ao Codex
  codex-response-1.json     # resposta original para conferência
  codex-response-2.json     # somente se houver tentativa de correção
```

## Seleção editorial com IA

O prompt em `src/editorial-prompt.txt` pede dois roteiros independentes: um carrossel que preserva os pontos centrais e seus detalhes úteis, e um reel mais curto. A IA pode **reescrever, condensar e criar chamadas fiéis ao original**, mantendo fatos, termos técnicos, atribuições e ressalvas. Não exige trechos literais nem deve inventar informações.

A capa pode apresentar uma chamada específica para o conteúdo ou resumir a ideia principal. Pode citar a pessoa, o cargo ou a empresa do original quando isso ajudar a contextualizar os conselhos. Por exemplo: “Como ser um dev produtivo, de acordo com Dax, um dos criadores do OpenCode”. Não há obrigação de entregar a conclusão na primeira imagem; chamadas genéricas e clickbait devem ser evitados.

Cada slide interno desenvolve uma ideia. Quando ela for curta, basta uma frase. Quando houver detalhes, a frase principal fica em negrito e a explicação em peso regular abaixo. Prefira mais páginas a reunir várias ideias numa imagem. Não corte itens centrais de uma lista para atingir uma quantidade fixa de slides e não invente explicações para preencher espaço. O tom é profissional, técnico e direto.

Os três exemplos em `examples/editorial.json` acompanham o prompt como referências de estilo: conselhos de Dax, competências na entrevista de Elizabeth e recomendações de FinOps da Coinbase. Seus fatos não devem ser transferidos para outros posts.

Limites: capa de até 100 caracteres e complemento opcional de até 160; de 1 a 19 páginas internas com frase principal de até 140 caracteres e explicação opcional de até 320. São limites do gerador, não metas de preenchimento. Com explicação longa, prefira um título curto; distribua o desenvolvimento em mais páginas quando necessário. O reel permite de 1 a 8 cenas de até 140 caracteres, mira 30–40 segundos e é validado para no máximo 45; posts curtos podem gerar vídeos menores.

A validação automática confere estrutura, tamanho e duração. Ela **não comprova fidelidade semântica**: compare o roteiro com o original e revise fatos, atribuições, contexto e cobertura das ideias antes de entregar as mídias. A renderização também verifica transbordamento, e a revisão visual continua obrigatória.

O Codex roda em uma pasta temporária, em modo `read-only`, com resposta estruturada por JSON Schema e prompt via stdin. A integração segue o [modo não interativo oficial](https://learn.chatgpt.com/docs/non-interactive-mode). Cada chamada tem limite de três minutos. Se o roteiro vier inválido, pede uma correção uma vez. Falhas de login, execução ou validação encerram o comando com código 1: não há fallback silencioso para o texto inteiro. Os arquivos já produzidos ficam no destino para diagnóstico.

## Fotos gratuitas do Unsplash

1. Gere o plano com `--plan-only` e consulte a direção visual em `roteiro.json`.
2. Busque termos relacionados à conclusão em `https://unsplash.com/s/photos/<termo>?license=free`, por exemplo [programming](https://unsplash.com/s/photos/programming?license=free).
3. Escolha uma foto real gratuita (não Unsplash+), clara, moderna, nítida, adequada ao recorte 4:5. Confira a página individual e baixe a foto.
4. Execute o gerador com `--image` e `--image-url` conforme os exemplos acima.

A busca e o download no site são manuais ou conduzidos pelo agente no navegador; a CLI não busca automaticamente no Unsplash. O Codex revisa a relação entre a foto e o post. Se reprovada, escolha outra e execute com uma nova pasta de saída. Um histórico impede repetir a mesma foto entre execuções.

A foto aparece só na capa do carrossel e em uma cena do reel. As páginas internas continuam com texto e cores variadas. `creditos-fotos.txt` contém a última linha da legenda: `Crédito da imagem: <link da página da foto>`.

Arquivos antigos não são alterados. O comando gera mídia local e não publica no Instagram. Todo reel recebe uma música de fundo da pasta `music/`.

## Música de fundo

Coloque as trilhas em `music/`, na raiz do projeto (MP3, WAV, M4A, AAC, FLAC ou OGG). A CLI escolhe automaticamente uma delas em cada geração; para indicar uma faixa, passe `--music nome-do-arquivo.mp3`. A seleção usa a pasta do projeto mesmo quando o comando é chamado de outro diretório.

A música acompanha todo o reel, com volume de fundo de 18%, entrada suave de um segundo e saída de dois segundos. Faixas curtas se repetem. `musica.json` registra a escolha. Se não houver música compatível, a geração para antes de chamar a etapa editorial; `--plan-only` continua funcionando sem áudio.

## Legendas e referências na publicação

O agente prepara as legendas à parte, usando o corpo completo do post ou um resumo fiel quando necessário para caber no limite vigente do Instagram. A ordem final é: corpo ou resumo, parágrafo de hashtags pertinentes, linha `Fonte original: <link fornecido>` quando houver e linha `Crédito da imagem: <link da página da foto no Unsplash>`. A contagem inclui todo esse conteúdo, espaços e quebras de linha. Preserve hashtags relevantes do original e remova duplicatas. Não coloque hashtags nas imagens ou cenas.

Se o texto ou o material fornecido com o post incluir o link da fonte original, inclua-o nas duas legendas, imediatamente acima do crédito da imagem, mesmo quando também houver um comentário separado com esse link. Use somente os links fornecidos e associados ao post; não invente uma fonte quando ela estiver ausente.

Comentários de referência, quando fornecidos, são preservados separadamente e associados ao ID do post após conferir a estrutura real do JSON. Não invente links nem considere que “link nos comentários” significa que a referência já foi publicada. Se o link não tiver sido fornecido, registre a pendência antes da publicação.

Essas tarefas fazem parte do atendimento pelo agente descrito em [AGENTS.md](AGENTS.md). A CLI gera mídia local e o arquivo de crédito; ela não importa JSON, prepara legendas ou publica automaticamente.

## Verificação

```bash
npm test
npm run generate -- examples/post.txt --plan-only
npm run generate -- examples/post.txt --image foto.jpg --image-url https://unsplash.com/photos/ID-DA-FOTO
```

Os testes automatizados usam um executável falso na fronteira com o Codex para verificar envio do texto, seleção, falhas e correção, sem consumir uso de IA. Os dois comandos de geração usam o Codex real.

### Cores e luminosidade

As fotos mantêm suas cores, com leve ajuste de luminosidade. Os fundos e painéis alternam carvão, azul-marinho e verde-escuro, com texto claro e cores estáveis ao renderizar o mesmo roteiro novamente. As capas usam Anton em caixa alta, uma aproximação da fonte condensada da referência StartSe (a fonte original não foi confirmada). Os slides internos usam Inter, com frase principal em negrito e explicação menor em peso regular, separadas por espaço generoso. O reel compartilha as cores sóbrias e mantém sua tipografia de cenas.

### Revisão visual obrigatória

Cada imagem é anexada ao Codex junto com o texto completo do post. A IA inspeciona pertinência, qualidade, anatomia, composição e aparência moderna. Aprovação exige relevância e qualidade ≥ 8/10, limpeza e modernidade ≥ 7/10. `avaliacoes-fotos.json` registra os resultados e as correções solicitadas. Se a revisão falhar, a geração para. Avaliações de IA podem errar; confira a capa antes de publicar.

### Crédito na legenda

Depois das hashtags, inclua `Fonte original: <link fornecido>` quando houver e termine com `Crédito da imagem: <link da página da foto no Unsplash>`. Essa linha substitui o aviso anterior de imagem gerada por IA. Conte também o link da fonte e o crédito no limite de caracteres. Para fotos reais sem geração ou alteração por IA, não ative o rótulo de IA só porque o Codex selecionou os trechos do texto. Se outro elemento da publicação for sintético, avalie-o separadamente.

## Materiais já preparados

Os arquivos locais em `out/` foram preservados na separação do repositório. Consulte `out/PUBLICACAO-MANUAL.md` ou `out/para-publicar/index.html` para acessar os 16 carrosséis preparados, em ordem, com suas legendas. Mídias, histórico e dependências ficam fora do Git.
