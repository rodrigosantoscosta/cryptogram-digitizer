// class Cell {
//     constructor(letter = null, status = 'unknown') {
//         this.letter = letter;
//         this.status = status; // e.g. 'correta'|'incorreta'|'unknown'
//     }

//     set(letter) {
//         this.letter = letter;
//         return true;
//     }

//     setStatus(status) {
//         this.status = status;
//     }

//     clear(resetStatus = false) {
//         this.letter = null;
//         if (resetStatus) this.status = 'unknown';
//     }

//     isEmpty() {

//         return this.letter == null || this.letter === '';
//     }

//     toString() {
//         return this.isEmpty() ? '_' : String(this.letter);
//     }
// }
class Cell{
    constructor(status, letter, hightlight){
        this.status = status;
        this. hightlight = hightlight;
    }
}

class Word{
    constructor(length, hint){
        this.length = length;
        this.hint = hint;
    }
}

