"use strict";

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const packageDefinition = protoLoader.loadSync('./protos/user.proto', {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const proto = grpc.loadPackageDefinition(packageDefinition);
const user = proto.user;
const client = new user.UserService('node:50051', grpc.credentials.createInsecure());

client.getUser({id: 1234}, function(error, response) {
    if (error) {
        console.error(error);
    } else {
        console.log('Response:', response);
    }
});
