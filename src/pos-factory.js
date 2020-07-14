const path = require('path')
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const { promisify } = require('util');

const PROTO_PATH = path.join(__dirname, '../protos/IPOS.proto');

module.exports = {
    getProxy: (url) => {
        const packageDefinition = protoLoader.loadSync(
            PROTO_PATH,
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });

        const grpcProxyObject = grpc.loadPackageDefinition(packageDefinition).fiskaltrust.ifPOS.v1;

        const client = new grpcProxyObject.POS(url, grpc.credentials.createInsecure());

        const promisifiedClient = {};
        for (let k in client) {
            if (typeof client[k] != 'function') continue;

            if (client[k].responseStream) {
                promisifiedClient[k] = (payload, onData) => {
                    let call = client[k](payload);

                    return new Promise((resolve, reject) => {
                        call.on('data', onData);
                        call.on('end', resolve);
                        call.on('error', reject);
                    });
                }
            } else {
                promisifiedClient[k] = promisify(client[k].bind(client));
            }
        }

        return promisifiedClient;
    }
}
