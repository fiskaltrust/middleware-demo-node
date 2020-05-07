const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = __dirname + '/../protos/IPOS.proto';

module.exports = {
    getProxy: function(url) {
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
        return new grpcProxyObject.POS(url, grpc.credentials.createInsecure());
    }
}