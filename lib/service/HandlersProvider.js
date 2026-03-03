const grpc = require('@grpc/grpc-js');
const log = require('bole')('grpc-php-adapter');
const promClient = require('prom-client');
const histogram = new promClient.Histogram({
    name: 'grpc_php_adapter_request_duration_milliseconds',
    help: 'Duration of gRPC requests traveling through FastCGI to PHP and back in milliseconds',
    labelNames: ['error', 'package_name', 'service_name', 'method_name']
});

class HandlersProvider {

    constructor(serviceDescription, connector) {
        this.serviceDescription = serviceDescription;
        this.connector = connector;
    }

    /**
     *
     * @returns {{}}
     */
    getHandlers() {
        let handlers = {};

        for (let methodDescription of this.serviceDescription.getMethodsDescriptions()) {
            if (methodDescription.isRequestStream || methodDescription.isResponseStream) {
                throw new Error('Streaming not implemented');
            }

            let handlerName = HandlersProvider.methodNameToHandlerName(methodDescription.methodName);

            handlers[handlerName] = this.createUnaryHandler(methodDescription);
        }
        log.debug("Got Handlers: '%o'", handlers);

        return handlers;
    }

    /**
     * Sends the request from gRPC to PHP via FastCGI and then sends the response back to the gRPC
     * server so it can send back the response to the client.
     *
     * @param methodDescription
     * @returns {function(*, *)}
     */
    createUnaryHandler(methodDescription) {
        return (call, callback) => {
            const hrstart = process.hrtime();

            let description = {
                error: 'none',
                package_name: methodDescription.packageName,
                service_name: methodDescription.serviceName,
                method_name: methodDescription.methodName
            };

            let promise = this.connector.send(
                methodDescription,
                JSON.stringify(call.request)
            );

            promise.then((output) => {
                let error = null;
                let value = null;
                let metadata = null;
                let response;

                try {
                    response = JSON.parse(output);
                } catch (e) {
                    let hrend = process.hrtime(hrstart);
                    description.error = 'invalid response from php';
                    histogram.observe(description, (hrend[0] * 1e9 + hrend[1]) / 1e6);

                    throw new Error('Invalid response: ' + output);
                }

                if (response.isSuccess === false) {
                    metadata = new grpc.Metadata();
                    metadata.set('error', response.error.message);
                    metadata.set('code', response.error.code.toString());
                    description.error = response.error.message;
                    histogram.observe(description, (hrend[0] * 1e9 + hrend[1]) / 1e6);

                    error = new Error(response.error.message);
                } else {
                    value = response.message
                }

                let hrend = process.hrtime(hrstart);
                histogram.observe(description, (hrend[0] * 1e9 + hrend[1]) / 1e6);

                callback(error, value, metadata);

                log.debug(`Served: %o`, description);

            }).catch((error) => {
                log.error(error);

                callback(error);
            });
        }
    }

    /**
     *
     * @param name
     * @returns {string}
     */
    static methodNameToHandlerName(name) {
        return name.charAt(0).toLocaleLowerCase() + name.slice(1)
    }
}

module.exports = HandlersProvider;

