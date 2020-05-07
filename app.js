'use strict'

const PROTO_PATH = __dirname + '/protos/IPOS.proto';
const RECEIPT_EXAMPLES_PATH = __dirname + '/receipt-examples/de';

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const prompt = require('prompt');
const JSONbig = require('json-bigint');
const readlineSync = require('readline-sync');

function getGrpcProxy(url) {
    var packageDefinition = protoLoader.loadSync(
        PROTO_PATH,
        {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });

    var grpcProxyObject = grpc.loadPackageDefinition(packageDefinition).fiskaltrust.ifPOS.v1;
    return new grpcProxyObject.POS(url, grpc.credentials.createInsecure());
}

function transformDateTimeToBeProtoCompliant(datetime) {
    if (!datetime) return undefined;

    return { value: new Date(datetime).getTime(), scale: 4, kind: 2 };
}

function transformDecimal(dec) {
    if (!dec) return undefined;

    // TODO: Replace this workaround with a proper serialization and also include the HI bits, instead of just cutting after 15 characters
    let decStr = dec.toString().substring(0, 15);
    let split = decStr.split(".");
    let precision = split.length == 2 ? split[1].length || 0 : 0;

    return { lo: decStr.replace('.', '').substring(0, 15), hi: 0, signScale: precision << 1 };
}

function loadExamples(files, cashboxId) {
    let examples = [];

    files.forEach(file => {
        let relative = path.relative(RECEIPT_EXAMPLES_PATH, file).replace("\\", "/");
        let rawdata = fs.readFileSync(file);
        let example = JSONbig.parse(rawdata);

        example.ftCashBoxID = cashboxId;
        example.ftReceiptCase = example.ftReceiptCase.toString();
        example.cbReceiptMoment = transformDateTimeToBeProtoCompliant(example.cbReceiptMoment);
        example.cbReceiptAmount = transformDecimal(example.cbReceiptAmount);
        example.cbChargeItems.forEach(chargeItem => {
            chargeItem.Quantity = transformDecimal(chargeItem.Quantity);
            chargeItem.Amount = transformDecimal(chargeItem.Amount);
            chargeItem.VATRate = transformDecimal(chargeItem.VATRate);
            chargeItem.VATAmount = transformDecimal(chargeItem.VATAmount);
            chargeItem.UnitQuantity = transformDecimal(chargeItem.UnitQuantity);
            chargeItem.ftChargeItemCase = chargeItem.ftChargeItemCase.toString();
        });
        example.cbPayItems.forEach(payItem => {
            payItem.Quantity = transformDecimal(payItem.Quantity);
            payItem.Amount = transformDecimal(payItem.Amount);
            payItem.ftPayItemCase = payItem.ftPayItemCase.toString();
        });
        examples.push({ name: relative, value: example })
    });

    return examples;
}

function byteArrayToString(array) {
    var result = "";
    for (var i = 0; i < array.length; i++) {
      result += String.fromCharCode(array[i]);
    }
    return result;
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

    if (input > 0 && input <= examples.length) {
        let example = examples[input - 1].value;
        console.log(JSON.stringify(example, null, 4));

        client.Sign(example, function (err, response) {
            if (err) {
                console.error(err);
            } else {
                console.log(JSON.stringify(response, null, 4));
            }

            readlineSync.question('Press enter to continue.', { hideEchoBack: true, mask: '' });
            console.clear();
            printMenu(examples, client);
        });
    }
    else if (input >= examples.length + 1 && input <= examples.length + 4) {
        let journalType = input - examples.length - 1;
        console.log(journalType);
        let result = [];
        let call = client.Journal({ ftJournalType: journalType });

        call.on('data', response => {            
            result = result.concat(response.Chunk);
        });
        call.on('end', () => {
            console.log(JSONbig.parse(byteArrayToString(result)));
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

        var client = getGrpcProxy(args.url);

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