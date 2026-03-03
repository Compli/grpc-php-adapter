const fs = require('fs');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const HandlersProvider = require('./HandlersProvider');
const ServiceDescription = require('./ServiceDescription');
const fastCGIConnector = require('./connector/FastCGIConnector');
const log = require('bole')('grpc-php-adapter');

class Service {
    constructor(config) {
        this.protoService = config.protoService;

        if (!fs.existsSync(config.protoFile)) {
            throw new Error(`${config.protoFile} file doesn't exist`);
        }

        if (!fs.existsSync(config.phpEntrypoint)) {
            throw new Error(`${config.phpEntrypoint} file doesn't exist`);
        }

        let packageDefinition = protoLoader.loadSync(config.protoFile, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });
        let proto = grpc.loadPackageDefinition(packageDefinition);
        log.debug("Loaded %s", config.protoFile);

        this.description = new ServiceDescription(config.protoService, proto);

        this.connector = new fastCGIConnector(config.phpEntrypoint, config.fastCGIOptions);

        this.handlersProvider = new HandlersProvider(this.description, this.connector);
    }
}

module.exports = Service;

