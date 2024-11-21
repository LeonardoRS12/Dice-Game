const crypto = require('crypto');
const readline = require('readline');
const Table = require('cli-table3');
const chalk = require('chalk');

class Dice {
    constructor(values) {
        if (values.length !== 6 || !values.every(Number.isInteger)) {
            throw new Error("Each dice must have 6 integer values.");
        }
        this.values = values;
    }
    roll() {
        return this.values[Math.floor(Math.random() * 6)];
    }
}

class DiceConfiguration {
    constructor(args) {
        this.dice = [];
        this.parseArgs(args);
    }
    parseArgs(args) {
        if (args.length < 3) {
            throw new Error("At least three dice configurations are required.");
        }
        args.forEach(arg => {
            const values = arg.split(',').map(Number);
            this.dice.push(new Dice(values));
        });
    }
}

class ProbabilityCalculator {
    calculateProbability(dice1, dice2) {
        let wins = 0;
        let total = 0;
        for (const roll1 of dice1.values) {
            for (const roll2 of dice2.values) {
                total++;
                if (roll1 > roll2) wins++;
            }
        }
        const probability = wins / total;
        return {
            fraction: `${wins}/${total}`,
            percentage: (probability * 100).toFixed(2)
        };
    }
}

class ProbabilityTable {
    constructor(diceSet) {
        this.diceSet = diceSet;
        this.calculator = new ProbabilityCalculator();
    }
    displayTable() {
        console.log(chalk.bold("\nProbability of the win for the user:"));
        console.log(
            chalk.italic(
                "The table shows the probabilities of each dice winning against others. Percentages are in parentheses."
            )
        );
        const table = new Table({
            head: [
                chalk.bold("User Dice \\ Against"),
                ...this.diceSet.map((dice, i) => chalk.bold(`Dice ${i + 1}: [${dice.values.join(",")}]`))
            ],
            colWidths: [30, ...this.diceSet.map(() => 20)],
            wordWrap: true
        });
        this.diceSet.forEach((dice1, i) => {
            const row = [`Dice ${i + 1}: [${dice1.values.join(",")}]`];
            this.diceSet.forEach((dice2, j) => {
                if (i === j) {
                    row.push(`- (${(1 / 3 * 100).toFixed(2)})`);
                } else {
                    const { fraction, percentage } = this.calculator.calculateProbability(dice1, dice2);
                    row.push(`${fraction} (${percentage}%)`);
                }
            });
            table.push(row);
        });
        console.log(table.toString());
    }
}

class FairRandomGenerator {
    constructor() {
        this.key = crypto.randomBytes(32);
    }
    generateHMAC(value) {
        return crypto.createHmac('sha3-256', this.key)
            .update(Buffer.from([value]))
            .digest('hex');
    }
    generateSecureValue(rangeMax) {
        const value = crypto.randomInt(0, rangeMax);
        const hmacVal = this.generateHMAC(value);
        return { value, hmac: hmacVal };
    }
    revealKey() {
        return this.key.toString('hex');
    }
}

class Game {
    constructor(diceConfig) {
        this.diceConfig = diceConfig;
        this.fairRandom = new FairRandomGenerator();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    async determineTurnOrder() {
        const { value: compVal, hmac: compHmac } = this.fairRandom.generateSecureValue(2);
        console.log(`Computer HMAC: ${compHmac}`);

        return new Promise((resolve) => {
            this.rl.question("Guess computer selection (0 or 1): ", (userGuess) => {
                if (parseInt(userGuess) === compVal) {
                    console.log(`Correct! Computer reveals key: ${this.fairRandom.revealKey()}`);
                    resolve('user');
                } else {
                    console.log(`Incorrect. Computer goes first (key: ${this.fairRandom.revealKey()}).`);
                    resolve('computer');
                }
            });
        });
    }

    async playRound(firstTurn) {
        console.log(`Starting round...`);
        const userDice = this.diceConfig.dice[0];
        const compDice = this.diceConfig.dice[1];
        const userRoll = userDice.roll();
        const compRoll = compDice.roll();
        console.log(`Your roll: ${userRoll} (from dice: ${userDice.values})`);
        console.log(`Computer's roll: ${compRoll} (from dice: ${compDice.values})`);
        if (userRoll > compRoll) {
            console.log("You win!");
        } else if (userRoll < compRoll) {
            console.log("Computer wins!");
        } else {
            console.log("It's a draw!");
        }
        this.rl.close();
    }

    async start() {
        console.log("Starting the game...");
        const firstTurn = await this.determineTurnOrder();
        const table = new ProbabilityTable(this.diceConfig.dice);
        table.displayTable();
        this.playRound(firstTurn);
    }
}

const args = process.argv.slice(2);
if (args.length < 3) {
    console.error("Usage: node game.js dice1 dice2 dice3 ...");
    process.exit(1);
}
try {
    const diceConfig = new DiceConfiguration(args);
    const game = new Game(diceConfig);
    game.start();
} catch (error) {
    console.error(`Error: ${error.message}`);
}