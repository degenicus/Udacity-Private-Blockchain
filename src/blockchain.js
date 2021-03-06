/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');
const { handleError } = require('./util');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            const block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        const self = this;
        return new Promise(async (resolve, reject) => {
            try {
                const errors = await this.validateChain();
                if (errors.length > 0) {
                    reject(errors);
                }
                if (self.height > -1) {
                    block.previousBlockHash = self.chain[self.height].hash;
                }
                block.time = self._getCurrentTimeString();
                self.height += 1;
                block.height = self.height;
                block.hash = SHA256(JSON.stringify(block)).toString();
                self.chain.push(block);
                resolve(block);
            } catch (error) {
                handleError(error, "_addBlock", reject);
            }
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            resolve(`${address}:${new Date().getTime().toString().slice(0,-3)}:starRegistry`);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        const self = this;
        return new Promise(async (resolve, reject) => {
            try {
                const messageTime = parseInt(message.split(':')[1]);
                const currentTime = parseInt(self._getCurrentTimeString());
                // Check if time elapsed is less than 5 minutes
                const fiveMinutesInSeconds = 300;
                if (currentTime - messageTime >= fiveMinutesInSeconds) {
                    reject("Too much time has passed since the message was created");
                }
                const isVerified = bitcoinMessage.verify(message, address, signature);
                if (!isVerified) {
                    reject("message cannot be verified");
                }
                const block = new BlockClass.Block({
                    owner: address,
                    star
                });
                resolve(self._addBlock(block));
            } catch (error) {
                handleError(error, "submitStar", reject);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        const self = this;
        return new Promise((resolve) => {
           const block = self.chain.filter(b => b.hash === hash)[0];
           resolve(block);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        const self = this;
        return new Promise((resolve, reject) => {
            try {
                const block = self.chain.find(p => p.height === height);
                resolve(block);
            } catch (error) {
                handleError(error, "getBlockByHeight", reject);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        const self = this;
        return new Promise(async (resolve) => {
            const blockData = await Promise.all(self.chain.map(b => b.getBData()));
            const ownerStars = blockData.filter(b => b.owner && b.owner === address);
            resolve(ownerStars);
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        const self = this;
        return new Promise(async (resolve) => {
            try {
                const errorLog = await Promise.all(self.chain.map(async block => {
                    const isBlockValid = await block.validate();
                    let hasPreviousBlock = true;
                    if (block.height > 0) {
                        const previousBlock = await self.getBlockByHash(block.previousBlockHash);
                        if (!previousBlock) {
                            hasPreviousBlock = false;
                        }
                    }
                    if (!isBlockValid || !hasPreviousBlock) {
                        let errorMessage = `Invalid block: ${JSON.stringify(block)}`;
                        if (!isBlockValid) {
                            errorMessage += " block did not pass .validate()";
                        }
                        if (!hasPreviousBlock) {
                            errorMessage += " previous block is missing";
                        }
                        return errorMessage;
                    }
                    return null;
                }));

                const onlyErrors = errorLog.filter(err => err !== null);
                resolve(onlyErrors);
            } catch (error) {
                handleError(error, "validateChain", reject);
            }
            
        });
    }

    _getCurrentTimeString() {
        return new Date().getTime().toString().slice(0, -3);
    }
}

module.exports.Blockchain = Blockchain;   