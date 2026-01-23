/**
 * =====================================================
 * CLASSE CELL (CLULA)
 * =====================================================
 * Representa uma nica clula do criptograma
 * Contm informaes sobre a letra, nmero e se est destacada
 */
class Cell {
    /**
     * CONSTRUTOR DA CLULA
     * @param {string} letter - A letra correta desta clula
     * @param {number} number - O nmero que aparece no canto da clula
     * @param {boolean} isHighlighted - Se faz parte da palavra vertical
     */
    constructor(letter, number, isHighlighted = false) {
        this.letter = letter.toUpperCase();  // Letra sempre em maiscula
        this.number = number;                // Nmero identificador
        this.isHighlighted = isHighlighted;  // Se  clula destacada
        this.userInput = '';                 // O que o usurio digitou (vazio inicialmente)
    }

    /**
     * MTODO: VERIFICAR SE EST CORRETA
     * @returns {boolean} - true se o usurio acertou
     */
    isCorrect() {
        return this.userInput.toUpperCase() === this.letter;
    }

    /**
     * MTODO: DEFINIR INPUT DO USURIO
     * @param {string} input - Letra digitada pelo usurio
     */
    setUserInput(input) {
        this.userInput = input.toUpperCase();
    }

    /**
     * MTODO: LIMPAR INPUT
     */
    clear() {
        this.userInput = '';
    }

    /**
     * MTODO: CONVERTER PARA OBJETO SIMPLES
     * til para salvar em JSON
     */
    toJSON() {
        return {
            letter: this.letter,
            number: this.number,
            isHighlighted: this.isHighlighted
        };
    }
}

/**
 * =====================================================
 * CLASSE WORD (PALAVRA)
 * =====================================================
 * Representa uma palavra completa do criptograma com suas celulas
 */
class Word {
    /**
     * CONSTRUTOR DA PALAVRA
     * @param {string} answer - A palavra correta
     * @param {string} clue - Dica para descobrir a palavra
     * @param {number[]} highlightedPositions - ndices das letras destacadas
     * @param {number} rowIndex - ndice da linha no grid
     */
    constructor(answer, clue, highlightedPositions, rowIndex) {
        this.answer = answer.toUpperCase();           // Resposta em maiscula
        this.clue = clue;                              // Dica para o usurio
        this.highlightedPositions = highlightedPositions; // Posies destacadas
        this.rowIndex = rowIndex;                      // Linha no grid
        this.cells = [];                               // Array de clulas
        
        // Cria as clulas para cada letra da palavra
        this.createCells();
    }

    /**
     * MTODO: CRIAR CLULAS
     * Cria um objeto Cell para cada letra da palavra
     */
    createCells() {
        for (let i = 0; i < this.answer.length; i++) {
            const letter = this.answer[i];
            const number = this.generateCellNumber(i);
            const isHighlighted = this.highlightedPositions.includes(i);
            
            const cell = new Cell(letter, number, isHighlighted);
            this.cells.push(cell);
        }
    }

    /**
     * MTODO: GERAR NMERO DA CLULA
     * Gera um nmero aleatrio para a clula (entre 1 e 28)
     * @param {number} index - ndice da letra na palavra
     * @returns {number}
     */
    generateCellNumber(index) {
        // Gera nmero aleatrio entre 1 e 28
        return Math.floor(Math.random() * 28) + 1;
    }

    /**
     * MTODO: OBTER LETRAS DESTACADAS
     * Retorna as letras que fazem parte da palavra vertical
     * @returns {string[]}
     */
    getHighlightedLetters() {
        return this.highlightedPositions.map(pos => this.answer[pos]);
    }

    /**
     * MTODO: VERIFICAR SE EST COMPLETA E CORRETA
     * @returns {boolean}
     */
    isCorrect() {
        return this.cells.every(cell => cell.isCorrect());
    }

    /**
     * MTODO: CONTAR ACERTOS
     * @returns {number}
     */
    countCorrect() {
        return this.cells.filter(cell => cell.isCorrect()).length;
    }

    /**
     * MTODO: LIMPAR TODAS AS CLULAS
     */
    clear() {
        this.cells.forEach(cell => cell.clear());
    }

    /**
     * MTODO: CONVERTER PARA OBJETO SIMPLES
     */
    toJSON() {
        return {
            answer: this.answer,
            clue: this.clue,
            highlightedPositions: this.highlightedPositions,
            cells: this.cells.map(cell => cell.toJSON())
        };
    }
}

/**
 * =====================================================
 * CLASSE CRYPTOGRAM BUILDER
 * =====================================================
 * Gerencia a criao interativa do criptograma via linha de comando
 */
class CryptogramBuilder {
    constructor() {
        this.words = [];           // Array de objetos Word
        this.wordCount = 0;        // Quantidade de palavras
        this.wordLength = 0;       // Tamanho padro das palavras
        this.verticalWord = '';    // Palavra que ser formada verticalmente
        this.verticalClue = '';    // Dica da palavra vertical
    }

    askLoop(question, validator) {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        const askAgain = () => {
            readline.question(question, (input) => {
                const result = validator(input);
                
                if (result.valid) {
                    readline.close();
                    resolve(result.value);
                } else {
                    console.log(` Erro: ${result.error}\n`);
                    askAgain(); //  repete at acertar
                }
            });
        };

        askAgain();
    });
}


    /**
     * MTODO: INICIAR CONSTRUO
     * Ponto de entrada principal do builder
     */
    async start() {
        console.clear();
        console.log('');
        console.log('    GERADOR DE CRIPTOGRAMA - LINHA DE COMANDO      ');
        console.log('\n');

        // Passo 1: Perguntar quantas palavras
        await this.askWordCount();

        // Passo 2: Perguntar tamanho das palavras
        await this.askWordLength();

        // Passo 3: Coletar palavras e dicas
        await this.collectWords();

        // Passo 4: Definir palavra vertical e clulas destacadas
        await this.defineVerticalWord();

        // Passo 5: Gerar JSON final
        this.generateOutput();
    }

    /**
     * MTODO: PERGUNTAR QUANTIDADE DE PALAVRAS
     */
    async askWordCount() {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            readline.question(' Quantas palavras ter o criptograma? ', (answer) => {
                this.wordCount = parseInt(answer);
                
                if (isNaN(this.wordCount) || this.wordCount < 1) {
                    console.log(' Erro: Digite um nmero vlido maior que 0!');
                    readline.close();
                    process.exit(1);
                }
                
                console.log(` Criptograma ter ${this.wordCount} palavras\n`);
                readline.close();
                resolve();
            });
        });
    }

    /**
     * MTODO: PERGUNTAR TAMANHO DAS PALAVRAS
     */
    async askWordLength() {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            readline.question(' Qual o tamanho de cada palavra? ', (answer) => {
                this.wordLength = parseInt(answer);
                
                if (isNaN(this.wordLength) || this.wordLength < 3) {
                    console.log(' Erro: Digite um nmero vlido maior ou igual a 3!');
                    readline.close();
                    process.exit(1);
                }
                
                console.log(` Cada palavra ter ${this.wordLength} letras\n`);
                readline.close();
                resolve();
            });
        });
    }

    /**
     * MTODO: COLETAR PALAVRAS E DICAS
     */
    async collectWords() {
        console.log('\n');
        console.log(' Agora vamos adicionar as palavras e suas dicas\n');

        for (let i = 0; i < this.wordCount; i++) {
            await this.collectSingleWord(i);
        }
    }

    /**
     * MTODO: COLETAR UMA NICA PALAVRA
     * @param {number} index - ndice da palavra atual
     */
    async collectSingleWord(index) {
        console.log(`\n PALAVRA ${index + 1}:`);

        const word = await this.askLoop(
            `   Digite a palavra (${this.wordLength} letras): `,
            (input) => {
                input = input.trim().toUpperCase();
                if (input.length !== this.wordLength) {
                    return { valid: false, error: `A palavra deve ter exatamente ${this.wordLength} letras!` };
                }
                return { valid: true, value: input };
            }
        );

        const clue = await this.askLoop(
            `   Digite a dica para esta palavra: `,
            (input) => {
                if (input.trim().length < 2) {
                    return { valid: false, error: "A dica deve ter pelo menos 2 caracteres!" };
                }
                return { valid: true, value: input.trim() };
            }
        );

        const newWord = new Word(word, clue, [], index);
        this.words.push(newWord);

        console.log(` Palavra "${word}" adicionada com sucesso!`);
}

    /**
     * MTODO: DEFINIR PALAVRA VERTICAL
     */
    async defineVerticalWord() {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('\n\n');
        console.log(' PALAVRA EM DESTAQUE (Vertical)\n');

        return new Promise((resolve) => {
            readline.question('Digite a palavra que ser formada nas clulas destacadas: ', (word) => {
                this.verticalWord = word.toUpperCase().trim();
                
                // Validar se  possvel formar essa palavra
                if (this.verticalWord.length > this.wordCount * this.wordLength) {
                    console.log(' Erro: Palavra vertical muito longa!');
                    readline.close();
                    process.exit(1);
                }
                
                readline.question('Digite a dica para a palavra vertical: ', (clue) => {
                    this.verticalClue = clue;
                    
                    // Agora vamos definir as clulas destacadas
                    console.log('\n Agora vamos marcar as clulas destacadas...\n');
                    
                    this.defineHighlightedCells();
                    
                    readline.close();
                    resolve();
                });
            });
        });
    }

    /**
     * MTODO: DEFINIR CLULAS DESTACADAS
     * Automaticamente distribui as letras da palavra vertical
     */
    defineHighlightedCells() {
        let verticalIndex = 0;
        
        // Percorre cada palavra
        for (let wordIndex = 0; wordIndex < this.words.length; wordIndex++) {
            const word = this.words[wordIndex];
            const targetLetter = this.verticalWord[verticalIndex];
            
            // Procura a letra na palavra atual
            for (let letterIndex = 0; letterIndex < word.answer.length; letterIndex++) {
                if (word.answer[letterIndex] === targetLetter) {
                    // Marca essa posio como destacada
                    word.highlightedPositions.push(letterIndex);
                    word.cells[letterIndex].isHighlighted = true;
                    
                    console.log(` Letra "${targetLetter}" encontrada em "${word.answer}" na posio ${letterIndex + 1}`);
                    
                    verticalIndex++;
                    
                    // Se j colocamos todas as letras da palavra vertical
                    if (verticalIndex >= this.verticalWord.length) {
                        return;
                    }
                    
                    break;
                }
            }
        }
        
        // Se chegou aqui e no completou, avisa o usurio
        if (verticalIndex < this.verticalWord.length) {
            console.log(`\n  Ateno: No foi possvel encontrar todas as letras de "${this.verticalWord}"`);
            console.log(`   Encontradas: ${verticalIndex} de ${this.verticalWord.length} letras`);
        }
    }

    /**
     * MTODO: GERAR SADA JSON
     * Cria o arquivo JSON com todos os dados do criptograma
     */
    generateOutput() {
        console.log('\n\n');
        console.log(' GERANDO ARQUIVO JSON...\n');

        const output = {
            metadata: {
                wordCount: this.wordCount,
                wordLength: this.wordLength,
                verticalWord: this.verticalWord,
                verticalClue: this.verticalClue
            },
            words: this.words.map(word => word.toJSON())
        };

        const fs = require('fs');
        const filename = 'criptograma-data.json';
        
        fs.writeFileSync(filename, JSON.stringify(output, null, 2));
        
        console.log(` Arquivo "${filename}" criado com sucesso!\n`);
        
        // Tambm mostra um resumo
        this.showSummary();
        
        // Gera cdigo JavaScript para usar no jogo
        this.generateGameCode();
    }

    /**
     * MTODO: MOSTRAR RESUMO
     */
    showSummary() {
        console.log(' RESUMO DO CRIPTOGRAMA:\n');
        console.log(`   Total de palavras: ${this.wordCount}`);
        console.log(`   Tamanho das palavras: ${this.wordLength} letras`);
        console.log(`   Palavra vertical: ${this.verticalWord}`);
        console.log(`   Dica vertical: ${this.verticalClue}\n`);
        
        console.log(' PALAVRAS:\n');
        this.words.forEach((word, index) => {
            const highlighted = word.getHighlightedLetters().join(', ');
            console.log(`   ${index + 1}. ${word.answer}`);
            console.log(`      Dica: ${word.clue}`);
            console.log(`      Letras destacadas: ${highlighted || 'Nenhuma'}\n`);
        });
    }

    /**
     * MTODO: GERAR CDIGO PARA O JOGO
     * Cria o array puzzleData pronto para usar no game.js
     */
    generateGameCode() {
        console.log('\n');
        console.log(' CDIGO JAVASCRIPT PARA O JOGO:\n');
        console.log('// Cole este cdigo no construtor da classe CriptogramaGame:\n');
        
        console.log('this.puzzleData = [');
        this.words.forEach((word, index) => {
            const comma = index < this.words.length - 1 ? ',' : '';
            console.log(`    { clue: "${word.clue}", answer: "${word.answer}", highlighted: [${word.highlightedPositions.join(', ')}] }${comma}`);
        });
        console.log('];\n');
        
        console.log(`// Dica da palavra vertical: ${this.verticalClue}`);
        console.log(`// Resposta vertical: ${this.verticalWord}\n`);
        
        // Salva tambm em arquivo
        const fs = require('fs');
        const code = this.generateFullGameCode();
        fs.writeFileSync('game-generated.js', code);
        console.log(' Arquivo "game-generated.js" criado com o cdigo completo!\n');
    }

    /**
     * MTODO: GERAR CDIGO COMPLETO DO JOGO
     * @returns {string}
     */
    generateFullGameCode() {
        let code = `// Cdigo gerado automaticamente pelo CLI Builder\n\n`;
        code += `class CriptogramaGame {\n`;
        code += `    constructor() {\n`;
        code += `        this.puzzleData = [\n`;
        
        this.words.forEach((word, index) => {
            const comma = index < this.words.length - 1 ? ',' : '';
            code += `            { clue: "${word.clue}", answer: "${word.answer}", highlighted: [${word.highlightedPositions.join(', ')}] }${comma}\n`;
        });
        
        code += `        ];\n\n`;
        code += `        // Palavra vertical: ${this.verticalWord}\n`;
        code += `        // Dica: ${this.verticalClue}\n\n`;
        code += `        this.cellNumbers = [\n`;
        
        this.words.forEach((word, index) => {
            const numbers = word.cells.map(cell => cell.number).join(', ');
            const comma = index < this.words.length - 1 ? ',' : '';
            code += `            [${numbers}]${comma}\n`;
        });
        
        code += `        ];\n\n`;
        code += `        this.initGame();\n`;
        code += `    }\n`;
        code += `    // ... resto dos mtodos do game.js\n`;
        code += `}\n`;
        
        return code;
    }
}

/**
 * =====================================================
 * EXECUO PRINCIPAL
 * =====================================================
 * Verifica se est rodando em Node.js e inicia o builder
 */
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Est rodando em Node.js
    const builder = new CryptogramBuilder();
    builder.start().catch(error => {
        console.error(' Erro:', error);
        process.exit(1);
    });
} else {
    console.log('  Este script deve ser executado com Node.js:');
    console.log('   node cryptogram-builder.js');
}