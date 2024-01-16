const {
    Authenticator,
    Chain,
    UALError,
    UALErrorType,
    User,
  } = require('universal-authenticator-library');
  const { JsonRpc } = require('eosjs');
  const { SignTransactionResponse } = require('universal-authenticator-library/dist/interfaces');
  const { MetaKeep } = require('metakeep');
  const axios = require('axios');
//   const { APIClient, Serializer } = require('@greymass/eosio');
  const { APIClient, NameType, PackedTransaction, Serializer, Transaction } = require('@greymass/eosio');

  
  const Logo = 'data:image/svg+xml,%3C%3Fxml version=\'1.0\' %3F%3E%3Csvg height=\'24\' version=\'1.1\' width=\'24\' xmlns=\'http://www.w3.org/2000/svg\' xmlns:cc=\'http://creativecommons.org/ns%23\' xmlns:dc=\'http://purl.org/dc/elements/1.1/\' xmlns:rdf=\'http://www.w3.org/1999/02/22-rdf-syntax-ns%23\'%3E%3Cg transform=\'translate(0 -1028.4)\'%3E%3Cpath d=\'m3 1030.4c-1.1046 0-2 0.9-2 2v7 2 7c0 1.1 0.8954 2 2 2h9 9c1.105 0 2-0.9 2-2v-7-2-7c0-1.1-0.895-2-2-2h-9-9z\' fill=\'%232c3e50\'/%3E%3Cpath d=\'m3 1049.4c-1.1046 0-2-0.9-2-2v-7-2-3h22v3 2 7c0 1.1-0.895 2-2 2h-9-9z\' fill=\'%2334495e\'/%3E%3Cpath d=\'m4 1032.9v1.1l2 2.4-2 2.3v1.1l3-3.4-3-3.5z\' fill=\'%23ecf0f1\'/%3E%3Cpath d=\'m3 2c-1.1046 0-2 0.8954-2 2v7 2 3h22v-3-2-7c0-1.1046-0.895-2-2-2h-9-9z\' fill=\'%2334495e\' transform=\'translate(0 1028.4)\'/%3E%3Cpath d=\'m4 5.125v1.125l3 1.75-3 1.75v1.125l5-2.875-5-2.875zm5 4.875v1h5v-1h-5z\' fill=\'%23ecf0f1\' transform=\'translate(0 1028.4)\'/%3E%3C/g%3E%3C/svg%3E';
//   var metakeep

  class MetakeepOptions {
    constructor(appId, appName, rpc) {
      this.appId = appId;
      this.appName = appName;
      this.rpc = rpc;
    }
  }
  
  class MetakeepData {
    constructor() {
      this.data = {};
    }
  }
  
  class MetakeepAuthenticator extends Authenticator {
    constructor(chains, options) {
      super(chains, options);
      this.chainId = chains[0].chainId;
      const [chain] = chains;
      const [rpc] = chain.rpcEndpoints;
  
      if (options && options.rpc) {
        this.rpc = options.rpc;
      } else {
        this.rpc = new JsonRpc(`${rpc.protocol}://${rpc.host}:${rpc.port}`);
        this.apiRpc = new JsonRpc(`${rpc.protocol}://${rpc.apiHost}:${rpc.port}`);
      }
      if (!options?.appId) {
        throw new Error('MetakeepAuthenticator: Missing appId');
      }
      this.appId = options.appId;
      this.chains = chains;
      this.accountEmail = '';
      try {
        this.accountEmail = window.localStorage.getItem('metakeep.logged') || '';
      } catch (error) {
        console.error('error', error);
      }
  
      try {
        this.cache = JSON.parse(window.localStorage.getItem('metakeep.data') || '{}');
      } catch (error) {
        console.error('error', error);
      }
    }
  
    saveCache() {
        try {
            window.localStorage.setItem('metakeep.data', JSON.stringify(this.cache));
        } catch (error) {
            console.error('error', error);
        }
    }
    
    async init() {
        //this.users = await this.login();
    }
    
    setEmail(email) {
        this.accountEmail = email;
        window.localStorage.setItem('metakeep.logged', email);
    }
    
    reset() {
        this.init();
    }
    
    isErrored() {
        return false;
    }
    
    getName() {
        return 'metakeep_native';
    }
    
    getOnboardingLink() {
        return 'https://developers.eos.io/manuals/eos/latest/cleos/index';
    }
    
    getError() {
        return null;
    }
    
    isLoading() {
        return false;
    }
    
    getStyle() {
        return {
            icon: Logo,
            text: 'metakeep',
            background: '#030238',
            textColor: '#FFFFFF',
        };
    }
    
    shouldRender() {
        return false;
    }
    
    shouldAutoLogin() {
        return true;
    }
    
    async shouldRequestAccountName() {
        return false;
    }
    
    async createAccount(publicKey) {
        return axios.post(`${this.apiRpc.endpoint}/v1/accounts/random`, {
            ownerKey: publicKey,
            activeKey: publicKey,
        }).then(response => response.data.accountName);
    }
    
    resolveAccountName(wallet) {
        console.log('resolveAccountName() ');
        return new Promise(async (resolve, reject) => {
            let accountName = '';
            if (!this.metakeep) {
                return reject(new Error('metakeep is not initialized'));
            }
            if (this.accountEmail === '') {
                return reject(new Error('No account email'));
            }
            // we check if we have the account name in the cache
            console.log('resolveAccountName() ', this.cache);
            const data = this.cache[this.accountEmail];
            if (data) {
                accountName = data[this.chainId]?.accounts[0];
                if (accountName) {
                    console.log('resolveAccountName() from cache -->', accountName);
                    resolve(accountName);
                    return;
                }
            }
    
            // if not, we fetch all the accounts for the email
            console.log('resolveAccountName() getting credentials...');
            // const credentials = await this.metakeep.getWallet();
            const publicKey = wallet.eosAddress;
    
            this.cache[this.accountEmail] = {
                [this.chainId]: {
                    accounts: [],
                    wallet: wallet,
                },
            };
    
            console.log('resolveAccountName() ', this.cache);
    
            try {
                // we try to get the account name from the public key
                // const temporalEndpoint = 'https://mainnet.telos.net'
                const response = await axios.post(`${this.rpc.endpoint}/v1/history/get_key_accounts`, {
                    public_key: publicKey,
                });
                console.log('resolveAccountName() get_key_accounts: ', response);
                const accountExists = response?.data?.account_names.length > 0;
                if (accountExists) {
                    accountName = response.data.account_names[0];
                } else {
                    accountName = await this.createAccount(publicKey);
                }
                this.cache[this.accountEmail][this.chainId].accounts.push(accountName);
                this.saveCache();
                return resolve(accountName);
            } catch (error) {
                console.error('error', error);
                throw new Error('Error getting account name');
            }
        });
    }
    
    
    async login() {
        // console.error('login');
        // if (this.accountEmail === '') {
        //     console.error('No account email');
        //     throw new Error('No account email');
        // }
    
        // console.log('Tenemos mail: ', this.accountEmail);
        // debugger
        this.metakeep = new MetaKeep({
            appId: this.appId,
            // user: {
            //     email: this.accountEmail,
            // },
        });
        const { user, wallet } = await this.metakeep.loginUser()
        this.accountEmail = user.email;
        console.log('this.accountEmail link',  this.accountEmail);
    
        const accountName = await this.resolveAccountName(wallet);
        console.log("accountName", accountName)
        const publicKey = this.cache[this.accountEmail][this.chainId].wallet.eosAddress;
    
        try {
            const permission = 'active';
            return [
                new MetakeepUser({
                    accountName,
                    permission,
                    publicKey,
                    chainId: this.chainId,
                    rpc: this.rpc,
                    metakeep: this.metakeep
                }),
            ];
        } catch (err) {
            throw new UALError(err.message, UALErrorType.Login, err, 'MetakeepAuthenticator');
        }
    }
    
    logout() {
        window.localStorage.removeItem('accountEmail');
        window.localStorage.removeItem('accountName');
        window.localStorage.removeItem('permission');
        window.localStorage.removeItem('publicKey');
        window.localStorage.removeItem('metakeep.logged');
        return;
    }
    
    requiresGetKeyConfirmation() {
        return false;
    }
    
  }
  
  class MetakeepUser extends User {
    constructor({
        accountName,
        permission,
        publicKey,
        chainId,
        rpc,
        metakeep
    }) {
        super();
        this.keys = [publicKey];
        this.accountName = accountName;
        this.permission = permission;
        this.chainId = chainId;
        this.rpc = rpc;
        // this.eosioCore = new APIClient({ url: 'https://testnet.telos.net' });
        console.log('this.eosioCore url', rpc.endpoint, rpc)
        this.eosioCore = new APIClient({ url: rpc.endpoint });
        this.metakeep = metakeep
    }

    async serializeActionData(account, name, data) {
        const { abi } = await this.eosioCore.v1.chain.get_abi(account);
        if (!abi) {
            throw new Error(`No ABI for ${account}`);
        }

        const { hexString } = Serializer.encode({ object: data, abi, type: name });
        return hexString;
    }

    // async signTransaction(transaction) {
    //     console.log('transaction', transaction);
    //     if (!this.metakeep) {
    //         throw new Error('metakeep is not initialized');
    //     }

    //     const info = await this.eosioCore.v1.chain.get_info();
    //     const ref_block_num = info.last_irreversible_block_num.toNumber();
    //     const block = await this.eosioCore.v1.chain.get_block(info.last_irreversible_block_num);
    //     const ref_block_prefix = block.ref_block_prefix.toNumber();
    //     const action = transaction.actions[0];

    //     const serializedData = await this.serializeActionData(action.account, action.name, action.data);
    //     action.data = serializedData;

    //     const expiration = new Date(Date.now() + 120000).toISOString().split('.')[0];

    //     console.log('chainId', this.chainId);
    //     const complete_transaction = {
    //         transactionObject: {
    //             rawTransaction: {
    //                 expiration: expiration,
    //                 ref_block_num: ref_block_num,
    //                 ref_block_prefix: ref_block_prefix,
    //                 max_net_usage_words: 0,
    //                 max_cpu_usage_ms: 0,
    //                 delay_sec: 0,
    //                 context_free_actions: [],
    //                 actions: [action],
    //                 transaction_extensions: [],
    //             },
    //             extraSigningData: {
    //                 // If chainId is part of the signature generation,
    //                 // send it inside extraSigningData field.
    //                 // chainId: '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f', // TESTNET
    //                 // chainId: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11', // MAINET
    //                 chainId: this.chainId
    //             },
    //         },
    //         reason: 'test',
    //     };

    //     console.log('await metakeep.signTransactio()...', complete_transaction);
    //     const response = await this.metakeep.signTransaction(complete_transaction, 'TESTING_REASONS');

    //     console.log('response', response);

    //     return this.returnEosjsTransaction(false, {});
    // }
    
    async signTransaction(originalTransaction) {
        if (!this.metakeep) {
            throw new Error('metakeep is not initialized');
        }
    
        try {
            // expire time in seconds
            const expireSeconds = 120;
    
            // Retrieve transaction headers
            const info = await this.eosioCore.v1.chain.get_info();
            const header = info.getTransactionHeader(expireSeconds);
    
            // collect all contract abis
            const abi_promises = originalTransaction.actions.map((a) =>
                this.eosioCore.v1.chain.get_abi(a.account)
            );
            const responses = await Promise.all(abi_promises);
            const abis = responses.map((x) => x.abi);
            const abis_and_names = originalTransaction.actions.map((x, i) => ({
                contract: x.account,
                abi: abis[i],
            }));
    
            // create complete well-formed transaction
            const transaction = Transaction.from(
                {
                    ...header,
                    actions: originalTransaction.actions,
                },
                abis_and_names
            );
    
            const expiration = transaction.expiration.toString();
            const ref_block_num = transaction.ref_block_num.toNumber();
            const ref_block_prefix = transaction.ref_block_prefix.toNumber();
    
            // convert actions to JSON
            const actions = transaction.actions.map((a) => ({
                account: a.account.toJSON(),
                name: a.name.toJSON(),
                authorization: a.authorization.map((x) => ({
                    actor: x.actor.toJSON(),
                    permission: x.permission.toJSON(),
                })),
                data: a.data.toJSON(),
            }));
    
            // compose the complete transaction
            const complete_transaction = {
                rawTransaction: {
                    expiration: expiration,
                    ref_block_num: ref_block_num,
                    ref_block_prefix: ref_block_prefix,
                    max_net_usage_words: 0,
                    max_cpu_usage_ms: 0,
                    delay_sec: 0,
                    context_free_actions: [],
                    actions: actions,
                    transaction_extensions: [],
                },
                extraSigningData: {
                    chainId: this.chainId,
                },
            };
    
            // sign the transaction with metakeep
            const reason = this.reasonCallback ? this.reasonCallback(originalTransaction) : 'sign this transaction';
            const response = await this.metakeep.signTransaction(complete_transaction, reason);
            const signature = response.signature;
    
            // Pack the transaction for transport
            const packedTransaction = PackedTransaction.from({
                signatures: [signature],
                packed_context_free_data: '',
                packed_trx: Serializer.encode({ object: transaction }),
            });
    
            // Broadcast the signed transaction to the blockchain
            const pushResponse = await this.eosioCore.v1.chain.push_transaction(packedTransaction);
    
            // we compose the final response
            const finalResponse = {
                wasBroadcast: true,
                transactionId: pushResponse.transaction_id,
                status: pushResponse.processed.receipt.status,
                transaction: packedTransaction,
            };
    
            return Promise.resolve(finalResponse);
        } catch (e) {
            if (e.status) {
                throw new Error(e.status);
            } else if (e.message) {
                throw new Error(e.message);
            } else {
                throw new Error('Unknown error');
            }
        }
    }
    

    async signArbitrary() {
        throw new Error('cleos does not support signing arbitrary data');
    }

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

  
  module.exports = MetakeepAuthenticator;
  