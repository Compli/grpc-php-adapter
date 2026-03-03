const grpc = require('@grpc/grpc-js');
const log  = require('bole')('grpc-php-adapter');

class Server {

    constructor() {
        this.grpcServer = new grpc.Server();
        this.services = [];
    }

    /**
     * Start the gRPC server
     *
     * @param connectionString
     * @returns {Promise.<TResult>}
     */
    start(connectionString) {

        this.grpcServer.bind(
            connectionString,
            grpc.ServerCredentials.createInsecure()
        );

        let connectorsReadyPromises = this.services.map((service) => {
            return service.connector.ready;
        });

        return Promise.all(connectorsReadyPromises).then(() => {
            this.grpcServer.start();
            log.info("gRPC Server started and bound to: '%s'", connectionString);

        }).catch((error) => {
            log.error(error);
        });
    }

    /**
     * Stop the gRPC server
     *
     * @returns {Promise.<T>}
     */
    stop() {
        return new Promise((resolve) => {
            this.grpcServer.tryShutdown(() => {
                let lastsRequestsPromise = this.services.map((service) => {
                    return service.connector.lastRequestPromise;
                }).filter((promise) => {
                    return promise !== null;
                });

                Promise.all(lastsRequestsPromise).then(resolve, resolve);
            });
        }).catch((error) => {
            throw error;
        });
    }

    /**
     * Add the based service to the gRPC server
     *
     * @param service
     */
    addService(service) {
        this.grpcServer.addService(
            service.description.getService(),
            service.handlersProvider.getHandlers()
        );
        log.debug("Added service: %s", service.protoService);

        this.services.push(service);
    }
}

module.exports = Server;

