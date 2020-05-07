'use strict'

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const prompt = require('prompt');
const JSONbig = require('json-bigint');
const readlineSync = require('readline-sync');
const protoHelpers = require('./helpers/proto-helpers')
const convert = require('./helpers/convert')
const posFactory = require('./pos-factory')

const RECEIPT_EXAMPLES_PATH = __dirname + '/../receipt-examples/de';

function loadExamples(files, cashboxId) {
    let examples = [];

    files.forEach(file => {
        let relative = path.relative(RECEIPT_EXAMPLES_PATH, file).replace("\\", "/");
        let rawdata = fs.readFileSync(file);
        let example = protoHelpers.convertReceiptRequestToProto(rawdata, cashboxId);

        examples.push({ name: relative, value: example })
    });

    return examples;
}

function printMenu(examples, client) {
    examples.forEach((example, index) => {
        console.log(`<${index + 1}>: ${example.name} - (${example.value.ftReceiptCase.toString(16)})`)
    });

    console.log(`\r\n<${examples.length + 1}>: Journal 0x0000000000000000 Version information`);
    console.log(`<${examples.length + 2}>: Journal 0x0000000000000001 ActionJournal in internal format`);
    console.log(`<${examples.length + 3}>: Journal 0x0000000000000002 ReceiptJournal in internal format`);
    console.log(`<${examples.length + 4}>: Journal 0x0000000000000003 QueueItemJournal in internal format`);
    console.log('\r\n<exit>: Close this program');

    let input = readlineSync.prompt({ limit: ['exit', /^[0-9]+$/], limitMessage: 'The given input is not supported.' });

    if (input == 'exit') {
        process.exit(0);
    }

    // Perform sign request
    if (input > 0 && input <= examples.length) {
        let example = examples[input - 1].value;

        console.log("Request:")
        console.log(JSONbig.stringify(example, null, 4));

        client.Sign(example, function (err, response) {
            if (err) {
                console.error(err);
            } else {
                console.log("Response:")
                console.log(JSONbig.stringify(response, null, 4));
            }

            readlineSync.question('Press enter to continue.', { hideEchoBack: true, mask: '' });
            console.clear();
            printMenu(examples, client);
        });
    }
    // Perform journal request
    else if (input >= examples.length + 1 && input <= examples.length + 4) {
        let journalType = input - examples.length - 1;
        let result = [];
        let call = client.Journal({ ftJournalType: journalType });

        call.on('data', response => {
            result = result.concat(response.Chunk);
        });
        call.on('end', () => {
            console.log(JSONbig.parse(convert.byteArrayToString(result)));
            readlineSync.question('Press enter to continue.', { hideEchoBack: true, mask: '' });
            console.clear();
            printMenu(examples, client);
        });
        call.on('error', e => {
            console.error(e);
        });
    }
    else {
        console.log('The given input is not supported.');
    }
}

function main() {
    var schema = {
        properties: {
            url: { default: 'localhost:10103', description: 'Please enter the middleware gRPC URL', required: true },
            cashboxId: { default: '737e2889-7d32-435d-a9e7-3de40e0fa156', description: 'Please enter your cashbox ID', message: 'Cashbox ID must be a GUID', required: true, pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/ }
        }
    };

    prompt.start();
    prompt.get(schema, function (err, args) {
        if (err) { return onErr(err); }

        var client = posFactory.getProxy(args.url);

        client.Echo({ Message: "Hello World!" }, function (err, response) {
            if (err) {
                console.error(err);
                return;
            }
            console.log('Echo response:', response.Message);

            glob(RECEIPT_EXAMPLES_PATH + '/**/*.json', function (err, files) {
                let examples = loadExamples(files, args.cashboxId);
                printMenu(examples, client);
            });
        });
    });
}

function onErr(err) {
    console.log(err);
    return 1;
}

main();