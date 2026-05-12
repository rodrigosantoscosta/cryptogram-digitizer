<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Estou desenvolvendo um digitalizador de criptogramas para web, estou desenvolvendo do zero. Divida em partes o projeto para ter um guia de desenvolvimento sólido.

Aqui está um guia estruturado, dividido em partes, para você desenvolver do zero o Digitalizador de Criptogramas (SPA, Vanilla JS) com foco em um fluxo sólido de desenvolvimento.

## 1) Visão geral do projeto

- Objetivo: construir um digitalizador de criptogramas desde a captura da imagem até a montagem de um mapa símbolo-letra, com exportação dos resultados.
- Restrições: sem build tools, sem frameworks; apenas HTML5, CSS3, JavaScript ES6+, canvas, sessionStorage. Isso facilita aprendizado e controle total, porém exige disciplina de módulo e organização.

Observação: o AGENTS.md já descreve o escopo e padrões de código que você pretende seguir; utilize-o como norte para padrões de modularização e organização de páginas. [AGENTS.md contém a arquitetura pretendida e padrões de código](file:1).

## 2) Estrutura de projeto (módulos e rotas)

- Arquitetura sugerida (adaptada ao seu stack):
    - index.html: shell da SPA.
    - css/: temas e estilos (variables.css, layout.css, components.css, reset.css).
    - js/: núcleo da aplicação com módulos ES6
        - app.js: gerencia roteamento simples (hash-based) e inicialização.
        - pages/: componentes de página
            - UploadPage.js: upload de imagem (drag-and-drop) e preview.
            - ProcessingPage.js: pipeline de processamento (grava o progresso, pode usar mocks inicialmente).
            - MappingPage.js: editor de mapping símbolo-letra e validações.
        - utils/: utilitários
            - storage.js: wrapper de sessionStorage com tratamento de erros.
            - helpers.js: funções auxiliares (formatação, conversões, downloads).
        - processing/: algoritmos de processamento de imagem (a serem implementados)
            - imageProcessor.js: binarização, grayscale, filtros básicos.
            - gridDetector.js: detecção de grade/linhas da criptografia.
            - symbolExtractor.js: extração de símbolos e classificação inicial.
- Arquivo AGENTS.md pode permanecer como guia de estilo (nomenclatura, padrões de módulo, patterns de página). Use-o como referência para manter consistência entre equipes futuras. (Conteúdo disponível no file:1.)

Demonstração rápida de modulação entre páginas:

- UploadPage.render() exibe UI de upload; UploadPage.attachEvents() registra drag-and-drop e seleção de arquivo.
- ProcessingPage.render() mostra área de processamento com barra de progresso; ProcessingPage.processImage() executa etapas (premissas iniciais: mock).
- MappingPage.render() apresenta grid de símbolos e painel de mapeamento; MappingPage.attachEvents() salva mappings via storage.js.


## 3) Fluxo de usuário ( MVP a pleno)

- Etapa 1: Upload
    - O usuário carrega uma imagem com criptograma.
    - Validação básica de tamanho e tipo; exibir pré-visualização.
- Etapa 2: Processamento (mock inicial)
    - Mostrar passos (preprocessamento, detecção de grade, extração) com barras de progresso falsas inicialmente.
    - Em MVP, retornar dados simulados (ex.: 10 símbolos A-J) para prosseguir.
- Etapa 3: Mapeamento
    - Apresentar quadro com símbolos detectados; permitir mapeamento simbólico para letras.
    - Salvar mappings em sessionStorage e disponibilizar exportação JSON.
- Exportação
    - Permitir download de JSON com mapeamento, estrutura da grade e símbolos extraídos.


## 4) Implementação incremental (alto nível)

- MVP (sem dependências externas)
    - MVP-UploadPage: arraste e solte; valide arquivo; use FileReader para obter data URL; exibir snapshot.
    - MVP-ProcessingPage: simular processamento com timer/steps; estruturar dados: grid, símbolos simulados.
    - MVP-MappingPage: tela de mapeamento com um grid de símbolos; salvar mapping em sessionStorage; exportar JSON.
- Progresso para realismo
    - imageProcessor.js: grayscale, binarization (threshold), suavização simples.
    - gridDetector.js: detecção de linhas horizontais/verticais (detecção de grade da criptografia).
    - symbolExtractor.js: segmentação de símbolos com base na grade detectada; classificação simples (caracteres únicos).
- Persistência
    - storage.js: wrappers safe para API window.sessionStorage com fallback para memória em caso de privação de privacidade.
    - Persistência opcional entre sessões pode ser adicionada com localStorage ou IndexedDB quando necessário.
- UX e acessibilidade
    - Indique estados de drag-and-drop, mensagens de erro claras, foco acessível nos botões, contrastes adequados.
    - Responsividade básica (grid de símbolos que se reorganiza em telas menores).


## 5) Arquivos-chave e responsabilidades

- index.html: layout base, containers para cada página.
- css/variables.css: paleta de cores, spacing, breakpoints.
- js/app.js: roteamento simples por hash (\#upload, \#processing, \#mapping); inicialização do app.
- js/pages/UploadPage.js: render, eventos de upload, validações de arquivo.
- js/pages/ProcessingPage.js: render, fluxo de processamento (mocks iniciais); hooks para integração futura com os módulos de processamento.
- js/pages/MappingPage.js: render, UI de mapeamento, salvar mappings, exportação JSON.
- js/utils/storage.js: abstração de sessionStorage com try/catch e serialização segura.
- js/utils/helpers.js: formatar tamanho de arquivo, download de JSON, conversões de dados.
- js/processing/imageProcessor.js, gridDetector.js, symbolExtractor.js: módulos de processamento (a serem integrados no ProcessingPage).


## 6) Boas práticas de código (baseadas no AGENTS.md)

- Modularização ES6: use exports/imports; evite globals; adote pattern PageName class com render, attachEvents, destroy.
- Nomeação: camelCase para variáveis e funções, PascalCase para classes, kebab-case para classes CSS, UPPER_SNAKE_CASE para constantes.
- Documentação de funções: adote JSDoc para funções com lógica complexa (ex.: preprocessImage, detectGrid, extractSymbols).
- Tratamento de erros: trate erros específicos (QuotaExceededError) e ofereça mensagens ao usuário.
- Organização de páginas: cada page deve encapsular seu state, lifecycle (render/attachEvents/destroy) e comunicação com utils.
- Testes manuais: inclua NEXT_STEPS.md com cenários de teste para cada página.


## 7) Plano de evolução (marcos práticos)

- Semanas 1–2: configuração do projeto estável, UploadPage funcional, processamento simulado, persistência básica.
- Semanas 3–4: implementação dos módulos de processamento real (imageProcessor, gridDetector, symbolExtractor); integração com ProcessingPage.
- Semanas 5–6: aperfeiçoar o MappingPage, adição de validações, exportação de JSON completo.
- Semanas 7+: otimizações de desempenho, testes manuais, acessibilidade, mobile-first, opções avançadas (OCR inicial hipotética, se desejar).

Illustrative example (estado inicial):

- MVP: UploadPage oferece drag-and-drop, ProcessingPage mostra barras de progresso simuladas, MappingPage salva mappings no sessionStorage e permite exportação de JSON.

Se desejar, posso gerar um esqueleto de código inicial para cada módulo (UploadPage.js, ProcessingPage.js, MappingPage.js, storage.js, imageProcessor.js, etc.) com hooks e estruturas básicas para você começar a codificar. Também posso adaptar o guia às suas preferências de estilo de código ou distribuir tarefas para alguém que possa colaborar.
<span style="display:none">[^1]</span>

<div align="center">⁂</div>

[^1]: AGENTS.md

