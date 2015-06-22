var Bitnation = require('./bitnation.core.js');
require('./bitnation.horizon.js');
require('./bitnation.encryption.js');
var jQuery = require('jquery');

(function (Bitnation, $) {

    /**
     * The notary feature will throw errors in the range
     * -201 through -299.
     */
    var _errorRange = -200;

    /**
     * An error thrown when a notarized document fails to verify
     */
    var _ERR_INVALID_NOTARY = {
        errorCode: _errorRange - 1,
        errorDescription: 'This is not a valid notarized document.'
    };

    /**
     * Notary service class
     */
    var Service = function () {
        var notaryService = {};

        /**
         * Initialise the Horizon client
         */
        var _hzClient = new Bitnation.horizon.Client();

        var _verifyNotaryUri = function (uri) {
            // Arbitrary safe uri max length of 100 for now
            var maxLength = 255;

            var accepted = (
                uri !== undefined &&
                typeof uri === 'string' &&
                uri.length > 0 &&
                uri.length <= maxLength
            );

            return accepted;
        }

        /**
         * Verify a notary transaction and its message
         */
        notaryService.verifyNotary = function (txId, messageTx) {
            var deferred = $.Deferred();

            var invalidMessageErr = Bitnation.core.errors.invalidMessage;

            if (messageTx.message == undefined &&
                messageTx.decryptedMessage === undefined) {
                deferred.reject(invalidMessageErr);
            }

            var protoMsg = Bitnation.core.ProtocolMessage();
            try {
                var message = protoMsg.fromMessageTx(messageTx);
            } catch (err) {
                return deferred.reject(err);
            }

            // Find the tx itself
            _hzClient.getTransaction(txId)
            .done(function (transaction) {
                var sender = transaction.senderRS;
                var recipient = transaction.recipientRS;

                if (sender !== recipient) {
                    return deferred.reject(_ERR_INVALID_NOTARY);
                }

                var response = {
                    verifiedNotary: message,
                    owner: sender
                };

                return deferred.resolve(response);

            })
            .fail(function (err) {
                deferred.reject(err);
            });

            return deferred.promise();
        };

        /**
         * Retrieve and parse a notary hash record
         */
        notaryService.retrieveNotary = function (txId, secretPhrase) {
            var deferred = $.Deferred();

            var verifyNotary = this.verifyNotary;

            _hzClient.readMessage(txId, secretPhrase)
            .done(function (messageTx) {

                verifyNotary(txId, messageTx)
                .done(function (result) {
                    deferred.resolve(result);
                })
                .fail(function (err) {
                    deferred.reject(err);
                });

            })
            .fail(function (err) {
                deferred.reject(err);
            });

            return deferred;
        };

        /**
         * Get up to a given number of a user's notarized documents.
         * Defaults to 10.
         */
        notaryService.getDocumentsForUser = function (account, limit) {
            limit = limit || 10;

            var deferred = $.Deferred();

            _hzClient.getMessages(account)
            .done(function (msgList) {
                var parsedMessages = [];

                var protoMsg = new Bitnation.core.ProtocolMessage();

                for (var i = 0; i < msgList.length; i++) {
                    if (i >= limit - 1) {
                        break;
                    }

                    try {
                        var message = protoMsg.fromMessageAttachment(
                            msgList[i].attachment
                        );

                        if (message.notary !== undefined) {
                            parsedMessages.push({
                                date: _hzClient.timestampToDate(
                                    msgList[i].blockTimestamp
                                ),
                                message: message
                            });
                        }
                    } catch (err) {
                        // Do nothing...
                    }
                }

                deferred.resolve(parsedMessages);

            })
            .fail(function (err) {
                deferred.reject(err);
            });

            return deferred.promise();
        };

        /**
         * Perform a hash on a file
         */
        notaryService.hashFile = function (file) {
            var fileHasher = new Bitnation.encryption.FileHasher(file);
            return fileHasher.getHash(file);
        };

        /**
         * Notarize a document, saving its hash into the Horizon blockchain
         */
        notaryService.notarizeDocument = function (file, secretPhrase, uri, isPrivate) {
            var deferred = $.Deferred();

            // Hash the file
            this.hashFile(file)
            .done(function (hash) {

                // Get HZ address from user's secret phrase
                _hzClient.getAccountId(secretPhrase)
                .done(function (accountIds) {

                    // Post to the blockchain
                    var message = new Bitnation.core.ProtocolMessage(
                        accountIds.accountRS, 'notary', { hash: hash }
                    );

                    if (_verifyNotaryUri(uri)) {
                        message.setFuncAttribute('uri', uri);
                    }

                    // Save the data in the blockchain
                    _hzClient.sendMessage(
                        message.accountRS, message.toString(), secretPhrase, isPrivate
                    ).done(function (result) {
                        var response = {
                            txId: result.transaction
                        };

                        _hzClient.getTransaction(response.txId)
                        .done(function (result) {
                            response.message = (result.attachment.encryptedMessage === undefined) ?
                                result.attachment.message : 'encrypted';

                            deferred.resolve(response);
                        })
                        .fail(function (err) {
                            deferred.reject(err);
                        });

                    })
                    .fail(function (err) {
                        deferred.reject(err);
                    });

                })
                .fail(function (err) {
                    deferred.reject(err);
                });

            })
            .fail(function (err) {
                deferred.reject(err);
            });

            return deferred;

        };

        return notaryService;
    };

    Bitnation.notary = {
        Service: Service
    };

})(Bitnation || {}, jQuery);