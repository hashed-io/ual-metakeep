/* eslint-disable */
const {
    Authenticator,
    UALError,
    UALErrorType,
    User,
} = require('universal-authenticator-library');
const { JsonRpc } = require('eosjs');
const { SignTransactionResponse } = require('universal-authenticator-library/dist/interfaces');
const { MetaKeep } = require('metakeep');
const axios = require('axios');
const { APIClient, PackedTransaction, Serializer, Transaction } = require('@greymass/eosio');
const { metakeepCache } = require('./utils/metakeep-cache');

const metakeep_name = 'metakeep.ual';
const Logo = 'data:image/svg+xml,%3C%3Fxml version=\'1.0\' %3F%3E%3Csvg height=\'24\' version=\'1.1\' width=\'24\' xmlns=\'http://www.w3.org/2000/svg\' xmlns:cc=\'http://creativecommons.org/ns%23\' xmlns:dc=\'http://purl.org/dc/elements/1.1/\' xmlns:rdf=\'http://www.w3.org/1999/02/22-rdf-syntax-ns%23\'%3E%3Cg transform=\'translate(0 -1028.4)\'%3E%3Cpath d=\'m3 1030.4c-1.1046 0-2 0.9-2 2v7 2 7c0 1.1 0.8954 2 2 2h9 9c1.105 0 2-0.9 2-2v-7-2-7c0-1.1-0.895-2-2-2h-9-9z\' fill=\'%232c3e50\'/%3E%3Cpath d=\'m3 1049.4c-1.1046 0-2-0.9-2-2v-7-2-3h22v3 2 7c0 1.1-0.895 2-2 2h-9-9z\' fill=\'%2334495e\'/%3E%3Cpath d=\'m4 1032.9v1.1l2 2.4-2 2.3v1.1l3-3.4-3-3.5z\' fill=\'%23ecf0f1\'/%3E%3Cpath d=\'m3 2c-1.1046 0-2 0.8954-2 2v7 2 3h22v-3-2-7c0-1.1046-0.895-2-2-2h-9-9z\' fill=\'%2334495e\' transform=\'translate(0 1028.4)\'/%3E%3Cpath d=\'m4 5.125v1.125l3 1.75-3 1.75v1.125l5-2.875-5-2.875zm5 4.875v1h5v-1h-5z\' fill=\'%23ecf0f1\' transform=\'translate(0 1028.4)\'/%3E%3C/g%3E%3C/svg%3E';

const { createApp, ref } = require('vue');
// const AccountCreation = require('utils/account-creation.vue').default
const AccountCreation = require('./utils/account-creation').default

let metakeep
class MetakeepUser extends User {
    constructor({
        accountName,
        permission,
        publicKey,
        chainId,
        rpc
    }) {
        super();
        this.keys = [publicKey];
        this.accountName = accountName;
        this.permission = permission;
        this.chainId = chainId;
        this.rpc = rpc;
        this.eosioCore = new APIClient({ url: rpc.endpoint });
    }

    setReasonCallback(callback) {
        this.reasonCallback = callback;
    }

    handleCatchError(error) {
        const errorMessage = error.message || error
        if (error.status === 'USER_REQUEST_DENIED') {
            return new Error('antelope.evm.error_transaction_canceled');
        } else {
            let customMessage = error.details[0].message || errorMessage
            return new Error(customMessage)
        }
    }
    
    async signTransaction (originalTransaction, txOptions = {}) {
        if (!metakeep) {
            throw new Error('metakeep is not initialized');
        }
    
        try {
            // expire time in seconds
            const expireSeconds = 120;
    
            // Retrieve transaction headers
            const info = await this.eosioCore.v1.chain.get_info();
            const header = info.getTransactionHeader(expireSeconds);
    
            // collect all contract abis
            const abi_promises = originalTransaction.actions.map(a =>
                this.eosioCore.v1.chain.get_abi(a.account),
            );
            const responses = await Promise.all(abi_promises);
            const abis = responses.map(x => x.abi);
            const abis_and_names = originalTransaction.actions.map((x, i) => ({
                contract: x.account,
                abi: abis[i],
            }));
    
            // create complete well formed transaction
            const transaction = Transaction.from(
                {
                    ...header,
                    actions: originalTransaction.actions,
                },
                abis_and_names,
            );
    
            const transaction_extensions = originalTransaction.transaction_extensions ?? [];
            const context_free_actions = originalTransaction.context_free_actions ?? [];
            const delay_sec = originalTransaction.delay_sec ?? 0;
            const max_cpu_usage_ms = originalTransaction.max_cpu_usage_ms ?? 0;
            const max_net_usage_words = originalTransaction.max_net_usage_words ?? 0;
            const expiration = originalTransaction.expiration ?? transaction.expiration.toString();
            const ref_block_num = originalTransaction.ref_block_num ?? transaction.ref_block_num.toNumber();
            const ref_block_prefix = originalTransaction.ref_block_prefix ?? transaction.ref_block_prefix.toNumber();
            // convert actions to JSON
            const actions = transaction.actions.map(a => ({
                account: a.account.toJSON(),
                name: a.name.toJSON(),
                authorization: a.authorization.map(x => ({
                    actor: x.actor.toJSON(),
                    permission: x.permission.toJSON(),
                })),
                data: a.data.toJSON(),
            }));
    
            // compose the complete transaction
            const complete_transaction = {
                rawTransaction: {
                    expiration,
                    ref_block_num,
                    ref_block_prefix,
                    max_net_usage_words,
                    max_cpu_usage_ms,
                    delay_sec,
                    context_free_actions,
                    actions,
                    transaction_extensions,
                },
                extraSigningData: {
                    chainId: this.chainId,
                },
            };
    
            // sign the transaction with metakeep
            const reason = this.reasonCallback ? this.reasonCallback(originalTransaction) : 'sign this transaction';
            const response = await metakeep.signTransaction(complete_transaction, reason);
            const signature = response.signature;
    
    
            // Pack the transaction for transport
            const packedTransaction = PackedTransaction.from({
                signatures: [signature],
                packed_context_free_data: '',
                packed_trx: Serializer.encode({ object: transaction }),
            });
    
            if (txOptions?.broadcast === false) {
                return {
                    wasBroadcast: false,
                    transactionId: '',
                    status: '',
                    transaction: packedTransaction,
                };
            }
            // Broadcast the signed transaction to the blockchain
            const pushResponse = await this.eosioCore.v1.chain.push_transaction(
                packedTransaction,
            );
    
            // we compose the final response
            const finalResponse = {
                wasBroadcast: true,
                transactionId: pushResponse.transaction_id,
                status: pushResponse.processed.receipt.status,
                transaction: packedTransaction,
            };
    
            return finalResponse;
    
        } catch (e) {
            throw this.handleCatchError(e);
        }
    }
    

    /**
     * Note: this method is not implemented yet
     *
     * @param publicKey     The public key to use for signing.
     * @param data                The data to be signed.
     * @param helpText        Help text to explain the need for arbitrary data to be signed.
     *
     * @returns                     The signature
     */
    async signArbitrary() {
        throw new Error('MetakeepUAL: signArbitrary not supported (yet)');
    }

    /**
     * @param challenge     Challenge text sent to the authenticator.
     *
     * @returns                     Whether the user owns the private keys corresponding with provided public keys.
     */
    async verifyKeyOwnership() {
        return true;
    }

    async getAccountName() {
        return this.accountName;
    }

    async getAccountPermission() {
        return this.permission;
    }

    async getChainId() {
        return this.chainId;
    }

    async getKeys() {
        return this.keys;
    }
}


class MetakeepAuthenticator extends Authenticator {
    constructor(chains, options) {
        super(chains, options);
        this.loading = false;
        this.userCredentials = { email: '', jwt: '' };
        this.chainId = chains[0].chainId;
        const [chain] = chains;
        const [rpc] = chain.rpcEndpoints;

        if (options && options.rpc) {
            this.rpc = options.rpc;
        } else {
            this.rpc = new JsonRpc(`${rpc.protocol}://${rpc.host}:${rpc.port}`);
        }
        if (!options?.appId) {
            throw new Error('MetakeepAuthenticator: Missing appId');
        }
        this.appId = options.appId;
        this.chains = chains;
        this.userCredentials = {
            email: metakeepCache.getLogged(),
            jwt: '',
        };
        this.executeRecaptchaRequest = options.executeRecaptchaRequest
        this.apiURL = options.apiURL
    }

    saveCache() {
        metakeepCache.saveCache();
    }

    async init() {
        //
    }

    setUserCredentials(credentials) {
        this.userCredentials = credentials;
        metakeepCache.setLogged(credentials.email);
    }

    /**
     * Resets the authenticator to its initial, default state then calls init method
     */
    reset() {
        this.init();
    }

    /**
     * Returns true if the authenticator has errored while initializing.
     */
    isErrored() {
        return false;
    }

    getName() {
        return metakeep_name;
    }

    /**
     * Returns a URL where the user can download and install the underlying authenticator
     * if it is not found by the UAL Authenticator.
     */
    getOnboardingLink() {
        return '';
    }

    /**
     * Returns error (if available) if the authenticator has errored while initializing.
     */
    getError() {
        return null;
    }

    /**
     * Returns true if the authenticator is loading while initializing its internal state.
     */
    isLoading() {
        return this.loading;
    }

    /**
     * Returns the style of the Button that will be rendered.
     */
    getStyle() {
        return {
            // An icon displayed to app users when selecting their authentication method
            icon: Logo,
            // Name displayed to app users
            text: metakeep_name,
            // Background color displayed to app users who select your authenticator
            background: '#030238',
            // Color of text used on top the `backgound` property above
            textColor: '#FFFFFF',
        };
    }

    /**
     * Returns whether or not the button should render based on the operating environment and other factors.
     * ie. If your Authenticator App does not support mobile, it returns false when running in a mobile browser.
     */
    shouldRender() {
        return true;
    }

    /**
     * Returns whether or not the dapp should attempt to auto-login with the Authenticator app.
     * Auto login will only occur when there is only one Authenticator that returns shouldRender() true and
     * shouldAutoLogin() true.
     */
    shouldAutoLogin() {
        return true;
    }

    /**
     * Returns whether or not the button should show an account name input field.
     * This is for Authenticators that do not have a concept of account names.
     */
    async shouldRequestAccountName() {
        return false;
    }

    async createAccount(publicKey) {
        try {
            const modalContainer = document.getElementById('c-app')
            return new Promise((approve, reject) => {
                const app = createApp(AccountCreation, {
                    onCancel: () => {
                      reject("User closed account creation dialog.")
                    },
                    onCreateAccount: (accountName) => {
                      approve(accountName)
                    },
                    executeRecaptchaRequest: this.executeRecaptchaRequest,
                    publicKey: publicKey,
                    apiURL: this.apiURL
                  })
                app.mount(modalContainer);
            })
        } catch (e) {
            console.error("Error trying to create account, please try again.", e);
            throw new Error("Error trying to create account, please try again.")
        }

    }

    resolveAccountName(wallet) {
        // console.log('resolveAccountName', wallet);
        return new Promise(async (resolve, reject) => {
            let accountName = '';
            if (!metakeep) {
                return reject(new Error('metakeep is not initialized'));
            }
            if (this.userCredentials.email === '') {
                return reject(new Error('No account email'));
            }

            // we check if we have the account name in the cache
            const accountNames = metakeepCache.getAccountNames(this.userCredentials.email, this.chainId);
            if (accountNames.length > 0 && accountNames[0] != null) {
                resolve(accountNames[0]);
                return;
            }

            // if not, we fetch all the accounts for the email
            // const credentials = await metakeep.getWallet();
            const credentials = { wallet };
            const publicKey = credentials.wallet.eosAddress;

            metakeepCache.addCredentials(this.userCredentials.email, credentials.wallet);

            try {
                // we try to get the account name from the public key
                const response = await axios.post(`${this.rpc.endpoint}/v1/history/get_key_accounts`, {
                    public_key: publicKey,
                });
                const accountExists = response?.data?.account_names.length > 0;
                if (accountExists) {
                    accountName = response.data.account_names[0];
                } else {
                    accountName = await this.createAccount(publicKey);
                }

                metakeepCache.addAccountName(this.userCredentials.email, this.chainId, accountName);
                this.saveCache();
                return resolve(accountName);
            } catch (error) {
                console.error('error', error);
                // throw new Error('Error getting account name');
                reject(error);
            }
        });
    }

    /**
     * Login using the Authenticator App. This can return one or more users depending on multiple chain support.
     *
     * @param accountName    The account name of the user for Authenticators that do not store accounts (optional)
     */
    login = async () => {

        // if (this.userCredentials.email === '') {
        //     throw new Error('No account email');
        // }

        this.loading = true;

        metakeep = new MetaKeep({
            // App id to configure UI
            appId: this.appId,
            // Signed in user's email address
            // user: {
            //     email: this.userCredentials.email,
            // },
        });
    
        let { user, wallet } = await metakeep.loginUser()
    
        this.setUserCredentials({
                email: user.email,
        })

        try {
            const accountName = await this.resolveAccountName(wallet);
            const publicKey = metakeepCache.getEosAddress(this.userCredentials.email);


            const permission = 'active';
            this.loading = false;
            const userInstance = new MetakeepUser({
                accountName,
                permission,
                publicKey,
                chainId: this.chainId,
                rpc: this.rpc
            });

            return [userInstance];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err) {
            
            this.loading = false;
            let message = (err.response?.data || err.message || err)
            throw new UALError(message, UALErrorType.Login, err, 'MetakeepAuthenticator');
        }
    };

    /**
     * Logs the user out of the dapp. This will be strongly dependent on each
     * Authenticator app's patterns.
     */
    logout = async () => {
        // console.log('logout', metakeep)
        metakeepCache.setLogged(null);
        metakeepCache.cleanCache()
        return;
    };

    /**
     * Returns true if user confirmation is required for `getKeys`
     */
    requiresGetKeyConfirmation() {
        return false;
    }
}


// ... (unchanged)

module.exports = MetakeepAuthenticator;
