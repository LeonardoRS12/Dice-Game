const crypto = require('crypto');
const chalk = require('chalk');
const Table = require('cli-table3');

class Dice {
    constructor(values) {
        this.values = values;
    }

    roll(index) {
        return this.values[index];
    }
}

class FairRandom {
    constructor(rangeMax) {
        this.rangeMax = rangeMax;
        this.key = crypto.randomBytes(32);
        this.value = this.generateUniformRandom(rangeMax);
        this.hmac = this.calculateHMAC();
    }
    calculateHMAC() {
        const hmac = crypto.createHmac('sha3-256', this.key);
        hmac.update(this.value.toString());
        return hmac.digest('hex');
    }
    generateUniformRandom(max) {
        let rand;
        const limit = 2 ** 32 - (2 ** 32 % max);
        do {
            rand = crypto.randomBytes(4).readUInt32BE(0);
        } while (rand >= limit);
        return rand % max;
    }
    revealKey() {
        return this.key.toString('hex');
    }
    getValue() {
        return this.value;
    }
}

class ProbabilityCalculator {
    static calculateProbabilities(diceList) {
        const n = diceList.length;
        const table = Array.from({ length: n }, () => Array(n).fill(0));
        diceList.forEach((d1, i) => {
            diceList.forEach((d2, j) => {
                if (i === j) return;
                let wins = 0;
                const total = d1.values.length * d2.values.length;
                d1.values.forEach((v1) => {
                    d2.values.forEach((v2) => {
                        if (v1 > v2) wins++;
                    });
                });
                table[i][j] = (wins / total).toFixed(4);
            });
        });
        return table;
    }

    static displayTable(diceList) {
        const probabilities = this.calculateProbabilities(diceList);
        console.log(chalk.greenBright('Probability of the win for the user:'));
        console.log(chalk.yellowBright('The rows represent the user’s dice choices, while the columns represent the computer’s dice choices.'));
        console.log(chalk.yellowBright('Values are probabilities that the dice in the row will beat the dice in the column.'));
        const table = new Table({
            head: ['User dice \\ Computer dice', ...diceList.map(dice => `[${dice.values.join(',')}]`)],
            style: { head: ['cyan'], border: ['gray'] },
        });
        diceList.forEach((userDice, i) => {
            const row = [`[${userDice.values.join(',')}]`];
            probabilities[i].forEach((prob, j) => {
                if (i === j) {
                    row.push(`- (${prob})`);
                } else {
                    row.push(prob);
                }
            });
            table.push(row);
        });
        console.log(table.toString());
    }
}

class DiceGame {
    constructor(diceConfigs) {
        this.dice = diceConfigs.map(config => new Dice(config.values));
        this.availableDice = [...this.dice];
        this.probabilityCalculator = new ProbabilityCalculator(this.dice);
    }
    start() {
        console.log("Let's determine who makes the first move.");
        const fairness = new FairRandom(2);
        console.log(`I selected a random value in the range 0..1 (HMAC=${fairness.hmac}).`);
        const userGuess = this.getUserInput('Try to guess my selection (0 or 1): ', [0, 1]);
        const computerValue = fairness.getValue();
        console.log(`My selection: ${computerValue} (KEY=${fairness.revealKey()}).`);
        const userFirst = userGuess === computerValue;
        if (userFirst) {
            console.log("You make the first move!");
            this.userSelectDice();
            this.computerSelectDice();
        } else {
            console.log("I make the first move!");
            this.computerSelectDice();
            this.userSelectDice();
        }
        console.log("Let's roll!");
        const computerRoll = this.computerThrow();
        const userRoll = this.userThrow();
        this.declareWinner(userRoll, computerRoll);
    }
    userSelectDice() {
        console.log('Choose your dice:');
        this.dice.forEach((die, index) => {
            console.log(`${index} - [${die.values.join(', ')}]`);
        });
        const selection = this.getUserInput('Your selection: ', [...Array(this.dice.length).keys()]);
        this.userDice = this.dice.splice(selection, 1)[0];
    }
    computerSelectDice() {
        const randomIndex = crypto.randomInt(this.dice.length);
        this.computerDice = this.dice.splice(randomIndex, 1)[0];
        console.log(`I choose the dice: [${this.computerDice.values.join(', ')}]`);
    }
    userThrow() {
        const fairness = new FairRandom(this.userDice.values.length);
        console.log(`I selected a random value in the range 0..${this.userDice.values.length - 1} (HMAC=${fairness.hmac}).`);
        const userInput = this.getUserInput(`Add your number modulo ${this.userDice.values.length}: `, [...Array(this.userDice.values.length).keys()]);
        const computerValue = fairness.getValue();
        console.log(`My number is ${computerValue} (KEY=${fairness.revealKey()}).`);
        const result = (userInput + computerValue) % this.userDice.values.length;
        console.log(`The result is ${userInput} + ${computerValue} = ${result} (mod ${this.userDice.values.length}).`);
        return this.userDice.roll(result);
    }

    computerThrow() {
        const fairness = new FairRandom(this.computerDice.values.length);
        console.log(`I selected a random value in the range 0..${this.computerDice.values.length - 1} (HMAC=${fairness.hmac}).`);
        const userInput = this.getUserInput(`Add your number modulo ${this.computerDice.values.length}: `, [...Array(this.computerDice.values.length).keys()]);
        const computerValue = fairness.getValue();
        console.log(`My number is ${computerValue} (KEY=${fairness.revealKey()}).`);
        const result = (userInput + computerValue) % this.computerDice.values.length;
        console.log(`The result is ${userInput} + ${computerValue} = ${result} (mod ${this.computerDice.values.length}).`);
        return this.computerDice.roll(result);
    }

    declareWinner(userRoll, computerRoll) {
        console.log(`Your throw: ${userRoll}`);
        console.log(`My throw: ${computerRoll}`);
        if (userRoll > computerRoll) {
            console.log('You win!');
        } else if (userRoll < computerRoll) {
            console.log('I win!');
        } else {
            console.log("It's a tie!");
        }
    }

    getUserInput(prompt, validInputs) {
        const readlineSync = require('readline-sync');
        while (true) {
            const input = readlineSync.question(prompt).trim();
            if (input.toLowerCase() === 'x') {
                console.log('Game exited.');
                process.exit();
            }
            if (input.toLowerCase() === '?') {
                ProbabilityCalculator.displayTable(this.dice);
                continue;
            }
            const parsed = parseInt(input, 10);
            if (!isNaN(parsed) && validInputs.includes(parsed)) {
                return parsed;
            }
            console.log('Invalid input. Try again.');
        }
    }
}

class DiceParser {
    static parseDice(args) {
        if (args.length < 3) {
            console.error(
                'Error: You must specify at least three dice configurations.\n' +
                'Example: node game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3'
            );
            process.exit(1);
        }
        const dice = args.map((arg, index) => {
            const values = arg.split(',').map(value => {
                if (isNaN(value)) {
                    console.error(
                        `Error: Dice ${index + 1} contains a non-integer value: "${value}".\n` +
                        'Each dice must have exactly six comma-separated integers.\n' +
                        'Example: 2,2,4,4,9,9'
                    );
                    process.exit(1);
                }
                return parseInt(value, 10);
            });
            if (values.length !== 6) {
                console.error(
                    `Error: Dice ${index + 1} does not have exactly six values.\n` +
                    'Each dice must have exactly six comma-separated integers.\n' +
                    'Example: 2,2,4,4,9,9'
                );
                process.exit(1);
            }
            return { values };
        });
        return dice;
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);
if (args.length === 0) {
    console.error(
        'Error: No dice configurations provided.\n' +
        'Usage: node game.js <dice1> <dice2> <dice3> ...\n' +
        'Example: node game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3'
    );
    process.exit(1);
}
const dice = DiceParser.parseDice(args);
const game = new DiceGame(dice);
game.start();
}