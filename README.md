# Instagram Carrossel

Recebe um `.txt`, chama o **Codex CLI para selecionar as ideias principais** e renderiza um carrossel de PNGs **1080 × 1350**, um reel MP4 H.264 **1080 × 1920 / 30 fps** e sua capa.

Adaptado do [gist de Paulo Silveira (peas)](https://gist.github.com/peas/2f224fbb9674734315079eb70dae8f60): usa o motor Remotion `Ensaio`, o estilo editorial e o princípio de recortar trechos do autor. A etapa editorial agora acontece automaticamente via Codex, antes da renderização. Projeto independente para gerar mídia local.

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

## Gerar a partir de um post

A entrada é **um arquivo `.txt` com o texto de um único post**. A lista de posts exportada em JSON não é uma entrada aceita por este comando.

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

O comando envia o post ao Codex, seleciona os trechos principais e gera o carrossel e o reel na mesma execução. As imagens mostram o conteúdo selecionado, sem “Ensaio”, “Continue a leitura”, nome do autor ou contador de página. Isso também vale para a capa do reel.

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
- `--model nome`: escolhe o modelo usado por `codex exec`; sem isso, usa a configuração do Codex.
- `--codex /caminho/codex`: executável alternativo; por padrão usa a versão local instalada por `npm ci`, inclusive ao chamar `node generate.mjs` de outro diretório.
- `--plan-only`: chama o Codex e salva apenas o roteiro, sem abrir navegador ou renderizar mídia.
- `--out pasta-nova`: destino. A pasta final não pode existir, para não sobrescrever arquivos.
- `--browser /caminho/chrome`: navegador para renderização.

Sem `--out`, cada execução cria `out/<nome>-<timestamp>/`.

```text
out/<nome>-<timestamp>/
  carrossel/01.png ...       # capa e slides; só os arquivos são numerados
  reel.mp4                  # texto animado, sem áudio
  capa-reel.png             # capa própria do reel
  carrossel.html            # prévia com fontes embutidas
  fotos/editorial.jpg       # foto aprovada (ou .png)
  avaliacoes-fotos.json    # aprovação, notas e motivos
  roteiro.json              # texto de origem e seleção validada da IA
  prompt.txt                # instruções editoriais e texto enviados ao Codex
  codex-response-1.json     # resposta original para conferência
  codex-response-2.json     # somente se houver tentativa de correção
```

## Seleção editorial com IA

O prompt em `src/editorial-prompt.txt` pede ao Codex dois roteiros independentes: carrossel que entrega a conclusão já na capa e desenvolve os argumentos nas páginas seguintes; reel ainda mais curto. Exemplos secundários e repetições são omitidos. O texto original deixa de ser paginado integralmente.

Como no playbook original, a IA **seleciona e reordena trechos literais**, sem inventar ou parafrasear o autor. O programa verifica se cada trecho aparece no post, ignorando diferenças de espaços e quebras de linha. Essa validação impede frases novas, mas a revisão humana ainda é importante para conferir contexto e seleção editorial.

A capa deve ser compreensível sozinha, com uma conclusão forte e acionável quando o original permitir. Pode combinar uma frase em fonte maior e uma explicação menor. As páginas seguintes também permitem essa hierarquia, aprofundando a ideia sem repetir a capa.

Limites: frase da capa com até 100 caracteres e complemento opcional de até 160; de 1 a 7 páginas com frase principal de até 100 caracteres e explicação opcional de até 220; de 1 a 8 cenas com até 140 caracteres cada. Textos longos podem ser enviados sem a antiga restrição de quantidade de páginas da entrada. O reel mira 30–40 segundos e é validado para no máximo 45; posts curtos podem gerar vídeos menores.

O Codex roda em uma pasta temporária, em modo `read-only`, com resposta estruturada por JSON Schema e prompt via stdin. A integração segue o [modo não interativo oficial](https://learn.chatgpt.com/docs/non-interactive-mode). Cada chamada tem limite de três minutos. Se o roteiro vier inválido, pede uma correção uma vez. Falhas de login, execução ou validação encerram o comando com código 1: não há fallback silencioso para o texto inteiro. Os arquivos já produzidos ficam no destino para diagnóstico.

## Fotos gratuitas do Unsplash

1. Gere o plano com `--plan-only` e consulte a direção visual em `roteiro.json`.
2. Busque termos relacionados à conclusão em `https://unsplash.com/s/photos/<termo>?license=free`, por exemplo [programming](https://unsplash.com/s/photos/programming?license=free).
3. Escolha uma foto real gratuita (não Unsplash+), clara, moderna, nítida, adequada ao recorte 4:5. Confira a página individual e baixe a foto.
4. Execute o gerador com `--image` e `--image-url` conforme os exemplos acima.

A busca e o download no site são manuais ou conduzidos pelo agente no navegador; a CLI não busca automaticamente no Unsplash. O Codex revisa a relação entre a foto e o post. Se reprovada, escolha outra e execute com uma nova pasta de saída. Um histórico impede repetir a mesma foto entre execuções.

A foto aparece só na capa do carrossel e em uma cena do reel. As páginas internas continuam com texto e cores variadas. `creditos-fotos.txt` contém a última linha da legenda: `Crédito da imagem: <link da página da foto>`.

Arquivos antigos não são alterados. O comando gera mídia local e não publica no Instagram. O reel continua sem áudio.

## Legendas e referências na publicação

Ao publicar carrosséis ou reels, use o corpo completo do post como legenda e **inclua hashtags relacionadas ao conteúdo no fim**. Preserve hashtags relevantes já existentes, evite duplicatas e acrescente hashtags específicas quando o original não tiver nenhuma. Se a legenda exceder o limite do Instagram, faça um resumo fiel que caiba junto com as hashtags. As hashtags ficam na legenda, não nas imagens ou cenas.

Essas são instruções para a etapa de publicação, registradas também em `AGENTS.md`. O comando de geração continua produzindo mídia local, sem publicar ou preparar legendas automaticamente.

O JSON usado no lote atual não contém o comentário com o link de referência. Um novo export incluirá esse comentário; a importação deverá ser adaptada depois de conferir o nome e a estrutura reais do campo, mantendo sua associação ao ID do post. Até lá, não invente links nem considere que “link nos comentários” significa que a referência já foi publicada. A entrada do comando continua sendo um `.txt` por post.

## Verificação

```bash
npm test
npm run generate -- examples/post.txt --plan-only
npm run generate -- examples/post.txt --image foto.jpg --image-url https://unsplash.com/photos/ID-DA-FOTO
```

Os testes automatizados usam um executável falso na fronteira com o Codex para verificar envio do texto, seleção, falhas e correção, sem consumir uso de IA. Os dois comandos de geração usam o Codex real.

### Cores e luminosidade

As fotos mantêm suas cores, com leve ajuste de luminosidade. Painéis claros garantem a leitura sem escurecer a imagem inteira. Os slides de texto alternam seis paletas (pêssego, menta, azul, rosa, lavanda e lima), com texto escuro e cores estáveis ao renderizar o mesmo roteiro novamente. O reel segue a mesma direção visual.

### Revisão visual obrigatória

Cada imagem é anexada ao Codex junto com o texto completo do post. A IA inspeciona pertinência, qualidade, anatomia, composição e aparência moderna. Aprovação exige relevância e qualidade ≥ 8/10, limpeza e modernidade ≥ 7/10. `avaliacoes-fotos.json` registra os resultados e as correções solicitadas. Se a revisão falhar, a geração para. Avaliações de IA podem errar; confira a capa antes de publicar.

### Crédito na legenda

Depois das hashtags, termine com `Crédito da imagem: <link da página da foto no Unsplash>`. Essa linha substitui o aviso anterior de imagem gerada por IA. Conte o crédito no limite de caracteres. Para fotos reais sem geração ou alteração por IA, não ative o rótulo de IA só porque o Codex selecionou os trechos do texto. Se outro elemento da publicação for sintético, avalie-o separadamente.

## Materiais já preparados

Os arquivos locais em `out/` foram preservados na separação do repositório. Consulte `out/PUBLICACAO-MANUAL.md` ou `out/para-publicar/index.html` para acessar os 16 carrosséis preparados, em ordem, com suas legendas. Mídias, histórico e dependências ficam fora do Git.
