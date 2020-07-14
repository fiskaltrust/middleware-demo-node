'use strict'

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const JSONbig = require('json-bigint');
const inquirer = require('inquirer');
const protoHelpers = require('./helpers/proto-helpers')
const convert = require('./helpers/convert')
const posFactory = require('./pos-factory')

const RECEIPT_EXAMPLES_PATH = __dirname + '/../receipt-examples/de';

function loadExamples(files, cashboxId) {
    let examples = [];

    files.forEach(file => {
        let relative = path.relative(RECEIPT_EXAMPLES_PATH, file).normalize();
        let rawdata = fs.readFileSync(file);
        let example = protoHelpers.convertReceiptRequestToProto(rawdata, cashboxId);

        examples.push({ name: relative, value: example })
    });

    return examples;
}

async function printMenu(examples, client) {
    let journals = [
        'Journal 0x0000000000000000 Version information',
        'Journal 0x0000000000000001 ActionJournal in internal format',
        'Journal 0x0000000000000002 ReceiptJournal in internal format',
        'Journal 0x0000000000000003 QueueItemJournal in internal format',
    ];

    examples
        .map(example => `${example.name} - (${example.value.ftReceiptCase.toString(16)})`)
        .concat(journals)
        .forEach((option, index) => console.log(`<${index + 1}>: ${option}`));

    console.log('<exit>: Close this program');

    let { input } = await inquirer.prompt([
        {
            name: 'input',
            message: '',
            type: 'input',
            validate: input => new Promise(resolve => {
                if (input === 'exit' || (input > 0 && input <= examples.length + journals.length)) {
                    resolve(true)
                } else {
                    throw 'The given input is not supported.';
                }
            })
        },
    ]);

    if (input == 'exit') {
        process.exit(0);
    }

    return input;
}

async function main() {
    let answers = await inquirer.prompt([
        {
            name: 'url',
            message: 'Please enter the middleware gRPC URL',
            default: 'localhost:1400',
            type: 'input',
            validate: input => new Promise(resolve => {
                if(/([0-9]{1,3}\.){3}[0-9]{1,3}(:[0-9]+)?(\/[^ ]*)*/g.test(input)) {
                    resolve(true);
                }
                try {
                    new URL(input);
                } catch (error) {
                    throw error.message;
                }

                resolve(true);
            })
        },
        {
            name: 'cashboxId',
            message: 'Please enter your cashbox ID',
            default: '737e2889-7d32-435d-a9e7-3de40e0fa156',
            type: 'input',
            validate: input => new Promise(resolve => {
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input)) {
                    resolve(true);
                } else {
                    throw 'Cashbox ID must be a GUID';
                }
            })
        }
    ]);

    let client = posFactory.getProxy(answers.url);

    let response = await client.Echo({ Message: "Hello World!" })
        .catch(error => {
            console.error(error);
            process.exit(1);
        });

    console.log(`\nEcho response: ${response.Message}\n`);

    let files = glob.sync(RECEIPT_EXAMPLES_PATH + '/**/*.json');
    let examples = loadExamples(files, answers.cashboxId);

    for (; ;) {
        let input = await printMenu(examples, client);

        // Perform sign request
        if (input > 0 && input <= examples.length) {
            let example = examples[input - 1].value;

            console.log("\nRequest:")
            console.log(JSONbig.stringify(example, null, 4));

            let response;
            try {
                response = await client.Sign(example);
            } catch(error) {
                console.error(error);
                continue;
            }

            console.log("\nResponse:")
            console.log(JSONbig.stringify(response, null, 4));
        }
        // Perform journal request
        else if (input >= examples.length + 1 && input <= examples.length + 4) {
            let journalType = input - examples.length - 1;
            let result = [];

            try {
                await client.Journal({ ftJournalType: journalType }, response => {
                    result = result.concat(response.Chunk);
                });
            } catch(error) {
                console.error(error);
                continue;
            }

            console.log("\nResponse:")
            console.log(JSONbig.parse(convert.byteArrayToString(result)));
        }

        await inquirer.prompt([{
            type: 'input',
            name: 'wait',
            message: 'Press enter to continue.',
        }]);

        console.clear();
    }
}

function onErr(err) {
    console.log(err);
    return 1;
}

main();
