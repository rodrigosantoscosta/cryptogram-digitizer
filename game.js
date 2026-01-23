class CriptogramaGame {
    constructor() {
        /**
         * DADOS DO PUZZLE
         * =====================================================
         * Array (lista) com todas as palavras, dicas e posições destacadas
         * 
         * Estrutura de cada item:
         * - clue: texto da dica que aparece à esquerda
         * - answer: resposta correta em maiúsculas
         * - highlighted: array com os índices das letras que fazem parte da palavra vertical
         */
        this.puzzleData = [
            { 
                clue: "Até este exato momento; até agora.", 
                answer: "AGORA", 
                highlighted: [1]
            },
            { 
                clue: "Que faz parte do indivíduo desde o nascimento.", 
                answer: "INATO", 
                highlighted: [1]
            },
            { 
                clue: "Aparecer como resultado de; acontecer depois.", 
                answer: "ADVIR", 
                highlighted: [1]
            },
            { 
                clue: "Ação de vender.", 
                answer: "VENDA", 
                highlighted: [1]
            },
            { 
                clue: "Pequeno instrumento para apitar ou assobiar.", 
                answer: "APITO", 
                highlighted: [1]
            },
            { 
                clue: "A começar de; a partir de.", 
                answer: "DESDE", 
                highlighted: [1]
            },
            { 
                clue: "Entre uma coisa e outra; entre.", 
                answer: "INTER", 
                highlighted: [1]
            },
            { 
                clue: "Matéria própria para fertilizar solos.", 
                answer: "ADUBO", 
                highlighted: [1]
            },
            { 
                clue: "Expressa a ideia de um processo em curso; existindo.", 
                answer: "ATIVO", 
                highlighted: [1]
            },
            { 
                clue: "Sensação causada pela gravidade.", 
                answer: "GRAVE", 
                highlighted: [1]
            },
            { 
                clue: "Espaço reservado aos expositores.", 
                answer: "STAND", 
                highlighted: [1]
            },
            { 
                clue: "Possuindo; ação de ter.", 
                answer: "TENDO", 
                highlighted: [1]
            }
        ];
        
        /**
         * MATRIZ DE NÚMEROS
         * =====================================================
         * Números que aparecem no canto superior esquerdo de cada célula
         * Cada sub-array representa uma linha do jogo
         */
        this.cellNumbers = [
            [26, 7, 12, 2, 27],
            [7, 12, 26, 18, 13],
            [26, 2, 20, 7, 16],
            [20, 3, 12, 2, 13],
            [26, 14, 7, 18, 13],
            [2, 3, 17, 2, 13],
            [7, 12, 18, 3, 16],
            [26, 2, 19, 27, 13],
            [17, 3, 12, 2, 13],
            [3, 12, 8, 13, 13],
            [17, 18, 26, 12, 2],
            [18, 3, 12, 2, 13]
        ];
        
        // Inicia o jogo criando o grid na tela
        this.initGame();
    }
    
    /**
     * MÉTODO: INICIAR O JOGO
     * =====================================================
     * Cria todo o HTML do grid dinamicamente
     * É chamado automaticamente pelo construtor
     * 
     * O que faz:
     * 1. Pega o elemento HTML onde o grid será criado
     * 2. Para cada palavra no puzzleData, cria uma linha
     * 3. Para cada letra da palavra, cria uma célula
     */
    initGame() {
        // Busca o elemento HTML com id="gameGrid"
        const grid = document.getElementById('gameGrid');
        
        // Limpa qualquer conteúdo anterior (se houver)
        grid.innerHTML = '';
        
        /**
         * LOOP PRINCIPAL
         * =====================================================
         * forEach é um método que percorre cada item de um array
         * 
         * Parâmetros:
         * - row: cada objeto do puzzleData (contém clue, answer, highlighted)
         * - rowIndex: índice da linha atual (0, 1, 2, 3...)
         */
        this.puzzleData.forEach((row, rowIndex) => {
            
            // Cria uma div para a linha completa
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';
            
            // Cria a div da dica (texto à esquerda)
            const clueDiv = document.createElement('div');
            clueDiv.className = 'clue';
            clueDiv.textContent = row.clue;
            rowDiv.appendChild(clueDiv);  // Adiciona a dica dentro da linha
            
            // Cria o container para as células de letras
            const cellsDiv = document.createElement('div');
            cellsDiv.className = 'cells';
            
            /**
             * LOOP SECUNDÁRIO - CRIAR CÉLULAS
             * =====================================================
             * Para cada letra da palavra, cria uma célula
             * Exemplo: "AGORA" tem 5 letras, então i vai de 0 até 4
             */
            for (let i = 0; i < row.answer.length; i++) {
                
                // Cria a div da célula
                const cellDiv = document.createElement('div');
                cellDiv.className = 'cell';
                
                /**
                 * VERIFICA SE A CÉLULA É DESTACADA
                 * =====================================================
                 * highlighted.includes(i) verifica se o índice atual está na lista
                 * Se está, adiciona a classe 'highlighted' (fundo amarelo)
                 */
                if (row.highlighted.includes(i)) {
                    cellDiv.classList.add('highlighted');
                }
                
                // Cria o número pequeno no canto
                const cellNumber = document.createElement('div');
                cellNumber.className = 'cell-number';
                cellNumber.textContent = this.getVerticalNumber(rowIndex, i);
                cellDiv.appendChild(cellNumber);
                
                /**
                 * CRIA O CAMPO DE INPUT
                 * =====================================================
                 * É onde o usuário vai digitar a letra
                 */
                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 1;  // Aceita apenas 1 caractere
                
                /**
                 * DATA ATTRIBUTES
                 * =====================================================
                 * Armazena dados personalizados no elemento HTML
                 * Usamos para saber depois qual é a resposta correta e posição
                 */
                input.dataset.row = rowIndex;      // Em qual linha está
                input.dataset.col = i;             // Em qual coluna está
                input.dataset.answer = row.answer[i];  // Qual letra é a correta
                
                /**
                 * EVENT LISTENER: INPUT
                 * =====================================================
                 * Escuta quando o usuário digita algo no campo
                 * 
                 * Arrow function (=>) é uma forma moderna de criar funções
                 * e: objeto do evento que contém informações sobre o que aconteceu
                 */
                input.addEventListener('input', (e) => {
                    // Converte para maiúscula automaticamente
                    e.target.value = e.target.value.toUpperCase();
                    
                    // Se digitou algo, tenta ir para o próximo campo
                    if (e.target.value) {
                        const nextInput = this.findNextInput(rowIndex, i);
                        if (nextInput) {
                            nextInput.focus();  // Coloca o cursor no próximo campo
                        }
                    }
                });
                
                /**
                 * EVENT LISTENER: KEYDOWN
                 * =====================================================
                 * Escuta quando uma tecla é pressionada
                 * Usado para detectar Backspace e voltar para o campo anterior
                 */
                input.addEventListener('keydown', (e) => {
                    // Se apertou Backspace e o campo está vazio
                    if (e.key === 'Backspace' && !e.target.value) {
                        const prevInput = this.findPrevInput(rowIndex, i);
                        if (prevInput) {
                            prevInput.focus();  // Volta para o campo anterior
                        }
                    }
                });
                
                // Adiciona o input dentro da célula
                cellDiv.appendChild(input);
                
                // Adiciona a célula no container de células
                cellsDiv.appendChild(cellDiv);
            }
            
            // Adiciona o container de células na linha
            rowDiv.appendChild(cellsDiv);
            
            // Adiciona a linha completa no grid
            grid.appendChild(rowDiv);
        });
    }
    
    /**
     * MÉTODO: PEGAR NÚMERO VERTICAL
     * =====================================================
     * Retorna o número que deve aparecer no canto da célula
     * 
     * Parâmetros:
     * - row: índice da linha (0-11)
     * - col: índice da coluna (0-4)
     * 
     * Retorna: número correspondente na matriz cellNumbers
     */
    getVerticalNumber(row, col) {
        return this.cellNumbers[row][col];
    }
    
    /**
     * MÉTODO: ENCONTRAR PRÓXIMO INPUT
     * =====================================================
     * Procura o próximo campo de input para mover o foco
     * 
     * Lógica:
     * 1. Tenta encontrar o próximo campo na mesma linha
     * 2. Se não existe, pega o primeiro campo da próxima linha
     */
    findNextInput(row, col) {
        // Busca todos os inputs da página
        const inputs = document.querySelectorAll('input');
        
        // Percorre todos os inputs
        for (let input of inputs) {
            // Converte data attributes para número
            const inputRow = parseInt(input.dataset.row);
            const inputCol = parseInt(input.dataset.col);
            
            // Se está na mesma linha e coluna é maior (à direita)
            if (inputRow === row && inputCol > col) {
                return input;  // Retorna este input
            }
        }
        
        // Se não achou na mesma linha, busca o primeiro da próxima linha
        const nextRowInputs = document.querySelectorAll(`input[data-row="${row + 1}"]`);
        return nextRowInputs[0] || null;  // Retorna o primeiro ou null se não existir
    }
    
    /**
     * MÉTODO: ENCONTRAR INPUT ANTERIOR
     * =====================================================
     * Procura o campo anterior para mover o foco ao apertar Backspace
     * 
     * Lógica:
     * Percorre todos os inputs e guarda o último que está antes da posição atual
     */
    findPrevInput(row, col) {
        const inputs = document.querySelectorAll('input');
        let prev = null;  // Variável para guardar o input anterior
        
        for (let input of inputs) {
            const inputRow = parseInt(input.dataset.row);
            const inputCol = parseInt(input.dataset.col);
            
            // Se está em linha anterior OU mesma linha mas coluna menor
            if (inputRow < row || (inputRow === row && inputCol < col)) {
                prev = input;  // Atualiza o anterior
            }
        }
        
        return prev;  // Retorna o último anterior encontrado
    }
    
    /**
     * MÉTODO: VERIFICAR RESPOSTAS
     * =====================================================
     * Compara o que o usuário digitou com as respostas corretas
     * Adiciona classes CSS (correct/incorrect) para feedback visual
     * Mostra mensagem com o resultado
     */
    checkAnswers() {
        // Busca todos os campos de input
        const inputs = document.querySelectorAll('input');
        
        // Variáveis para contar acertos
        let correct = 0;
        let total = 0;
        
        /**
         * PERCORRE TODOS OS INPUTS
         * =====================================================
         * Para cada input, verifica se está correto
         */
        inputs.forEach(input => {
            total++;  // Incrementa total de células
            
            // Pega a célula pai do input
            const cell = input.parentElement;
            
            // Remove classes anteriores (limpa estado)
            cell.classList.remove('correct', 'incorrect');
            
            /**
             * COMPARAÇÃO
             * =====================================================
             * Compara o valor digitado (em maiúscula) com a resposta correta
             */
            if (input.value.toUpperCase() === input.dataset.answer) {
                // Se estiver correto
                cell.classList.add('correct');  // Adiciona classe verde
                correct++;  // Incrementa contador de acertos
            } else if (input.value) {
                // Se tiver algo digitado mas estiver errado
                cell.classList.add('incorrect');  // Adiciona classe vermelha
            }
            // Se estiver vazio, não adiciona classe nenhuma
        });
        
        /**
         * MOSTRAR MENSAGEM DE FEEDBACK
         * =====================================================
         * Busca o elemento de mensagem e define seu conteúdo e estilo
         */
        const message = document.getElementById('message');
        
        if (correct === total) {
            // Se acertou todas
            message.className = 'message success';
            message.textContent = '🎉 Parabéns! Você completou o criptograma!';
        } else {
            // Se ainda tem erros
            message.className = 'message error';
            message.textContent = `${correct} de ${total} letras corretas. Continue tentando!`;
        }
        
        /**
         * ESCONDER MENSAGEM APÓS 3 SEGUNDOS
         * =====================================================
         * setTimeout executa uma função depois de X milissegundos
         * 3000ms = 3 segundos
         */
        setTimeout(() => {
            message.style.display = 'none';
        }, 3000);
    }
    
    /**
     * MÉTODO: DAR DICA
     * =====================================================
     * Preenche automaticamente uma célula vazia aleatória com a resposta correta
     */
    giveHint() {
        // Busca todos os inputs da página
        const inputs = document.querySelectorAll('input');
        
        /**
         * FILTRAR INPUTS VAZIOS
         * =====================================================
         * Array.from() converte NodeList em Array
         * filter() cria novo array apenas com inputs vazios
         */
        const emptyInputs = Array.from(inputs).filter(input => !input.value);
        
        // Se não tem células vazias, mostra alerta
        if (emptyInputs.length === 0) {
            alert('Todas as células já estão preenchidas!');
            return;  // Sai da função
        }
        
        /**
         * ESCOLHER CÉLULA ALEATÓRIA
         * =====================================================
         * Math.random() gera número entre 0 e 1
         * Multiplica pelo tamanho do array e arredonda para baixo
         * Resultado: índice aleatório do array
         */
        const randomIndex = Math.floor(Math.random() * emptyInputs.length);
        const randomInput = emptyInputs[randomIndex];
        
        // Preenche com a resposta correta
        randomInput.value = randomInput.dataset.answer;
        
        // Adiciona classe 'correct' (fundo verde)
        randomInput.parentElement.classList.add('correct');
    }
    
    /**
     * MÉTODO: LIMPAR GRID
     * =====================================================
     * Remove todos os valores digitados e classes de feedback
     * Pede confirmação antes de executar
     */
    clearGrid() {
        /**
         * CONFIRMAÇÃO
         * =====================================================
         * confirm() mostra uma caixa de diálogo com OK/Cancelar
         * Retorna true se o usuário clicar OK, false se cancelar
         */
        if (confirm('Tem certeza que deseja limpar todas as respostas?')) {
            // Busca todos os inputs
            const inputs = document.querySelectorAll('input');
            
            // Percorre e limpa cada um
            inputs.forEach(input => {
                input.value = '';  // Limpa o valor
                
                // Remove classes de feedback
                input.parentElement.classList.remove('correct', 'incorrect');
            });
            
            // Esconde a mensagem de feedback
            document.getElementById('message').style.display = 'none';
        }
    }

    highlightCell(){

    }
}