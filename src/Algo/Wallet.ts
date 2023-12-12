import {
  generateAccount,
  mnemonicFromSeed,
  mnemonicToSecretKey,
  secretKeyToMnemonic,
  Account,
  Algodv2,
  makePaymentTxnWithSuggestedParamsFromObject,
  waitForConfirmation,
  encodeUnsignedSimulateTransaction,
  Transaction,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
} from 'algosdk'
import base32 from 'hi-base32'
import { BigNumber } from 'bignumber.js'

function createPrivateKey(templatePrivateKey: string, password: string) {
  const crypto = require('crypto')
  const hash = crypto
    .createHash('sha256')
    .update(templatePrivateKey + password, 'utf8')
    .digest('hex')
  return hash.substring(0, 64) // Truncate to 64 characters (32 bytes)
}

function format(from: number, to: number, amount: number | string | BigNumber) {
  const bigNum = new BigNumber(amount)
  if (bigNum.isNaN()) {
    return amount
  }

  return bigNum.multipliedBy(Math.pow(10, from)).dividedBy(Math.pow(10, to))
}

/**
 * Wallet class who respect the WalletLibraryInterface for Keepix
 */
export class Wallet {
  private wallet: Account
  private mnemonic?: string
  private type: string
  private keepixTokens?: { coins: any; tokens: any }
  private rpc?: any
  private client: Algodv2

  constructor({
    password,
    mnemonic,
    privateKey,
    type,
    keepixTokens,
    rpc,
    privateKeyTemplate = '0x2050939757b6d498bb0407e001f0cb6db05c991b3c6f7d8e362f9d27c70128b9',
  }: {
    password?: string
    mnemonic?: string
    privateKey?: string
    type: string
    keepixTokens?: { coins: any; tokens: any } // whitelisted coins & tokens
    rpc?: any
    privateKeyTemplate?: string
  }) {
    this.type = type
    this.keepixTokens = keepixTokens
    this.rpc = rpc
    this.client = new Algodv2('', rpc, 443)

    // from password
    if (password !== undefined) {
      const newSeed = createPrivateKey(privateKeyTemplate, password)
      this.mnemonic = mnemonicFromSeed(Buffer.from(newSeed, 'hex'))
      this.wallet = mnemonicToSecretKey(this.mnemonic)
      return
    }
    // from mnemonic
    if (mnemonic !== undefined) {
      this.mnemonic = mnemonic
      this.wallet = mnemonicToSecretKey(this.mnemonic)
      return
    }
    // from privateKey only
    if (privateKey !== undefined) {
      this.mnemonic = secretKeyToMnemonic(
        Buffer.from(base32.decode.asBytes(privateKey)),
      )
      this.wallet = mnemonicToSecretKey(this.mnemonic)
      return
    }
    // Random
    this.wallet = generateAccount()
    this.mnemonic = secretKeyToMnemonic(this.wallet.sk)
  }

  // PUBLIC

  public getPrivateKey() {
    return base32.encode(this.wallet.sk)
  }

  public getMnemonic() {
    return this.mnemonic
  }

  public getAddress() {
    return this.wallet.addr
  }

  public getProdiver() {
    return this.client
  }

  public getConnectedWallet() {
    return this.wallet
  }

  // always display the balance in 0 decimals like 1.01 ALGO
  public async getCoinBalance(walletAddress?: string) {
    try {
      const accInfo = await this.client
        .accountInformation(walletAddress ?? this.wallet.addr)
        .do()
      return format(0, 6, accInfo.amount).toString()
    } catch (err) {
      console.log(err)
      return '0'
    }
  }

  // always display the balance in 0 decimals like 1.01 RPL
  public async getTokenBalance(tokenAddress: string, walletAddress?: string) {
    try {
      const assetInfo = await this.client
        .getAssetByID(Number(tokenAddress))
        .do()
      const accInfo = await this.client
        .accountInformation(walletAddress ?? this.wallet.addr)
        .do()
      const asset = accInfo?.assets?.find(
        (item: any) => item?.['asset-id'] === Number(tokenAddress),
      )
      return format(
        0,
        assetInfo?.params?.decimals ?? 0,
        asset?.amount ?? 0,
      ).toString()
    } catch (err) {
      console.log(err)
      return '0'
    }
  }

  public async estimateCostOfTx(tx: Transaction) {
    try {
      const estTx = tx.signTxn(this.wallet.sk)
      const result = await this.client.simulateRawTransactions(estTx).do()
      if (result.txnGroups[0].failureMessage) {
        return {
          success: false,
          description: result.txnGroups[0].failureMessage,
        }
      }
      return { success: true, description: result.lastRound }
    } catch (err: any) {
      return {
        success: false,
        description: `Estimation Failed: ${err}`,
      }
    }
  }

  public async estimateCostSendCoinTo(receiverAddress: string, amount: string) {
    try {
      const suggestedParams = await this.client.getTransactionParams().do()
      const parsedAmount = format(6, 0, amount).toString()
      const tx = makePaymentTxnWithSuggestedParamsFromObject({
        from: this.wallet.addr,
        to: receiverAddress,
        amount: BigInt(parsedAmount),
        suggestedParams,
      })
      return await this.estimateCostOfTx(tx)
    } catch (err) {
      return { success: false, description: `Estimation Failed: ${err}` }
    }
  }

  public async sendCoinTo(receiverAddress: string, amount: string) {
    try {
      const suggestedParams = await this.client.getTransactionParams().do()
      const parsedAmount = format(6, 0, amount).toString()
      const tx = makePaymentTxnWithSuggestedParamsFromObject({
        from: this.wallet.addr,
        to: receiverAddress,
        amount: BigInt(parsedAmount),
        suggestedParams,
      })
      const signedTx = tx.signTxn(this.wallet.sk)
      const { txId } = await this.client.sendRawTransaction(signedTx).do()
      const result = await waitForConfirmation(this.client, txId, 4)
      console.log(result, txId)
      return { success: true, description: result?.['confirmed-round'] }
    } catch (err: any) {
      return {
        success: false,
        description: `Transaction Failed: ${
          err?.response?.body?.message ?? err
        }`,
      }
    }
  }

  public async sendTokenTo(
    tokenAddress: string,
    receiverAddress: string,
    amount: string,
  ) {
    try {
      const assetInfo = await this.client
        .getAssetByID(Number(tokenAddress))
        .do()

      const suggestedParams = await this.client.getTransactionParams().do()
      const parsedAmount = format(
        assetInfo?.params?.decimals ?? 0,
        0,
        amount,
      ).toString()
      const tx = makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: this.wallet.addr,
        to: receiverAddress,
        assetIndex: Number(tokenAddress),
        amount: BigInt(parsedAmount),
        suggestedParams,
      })

      const signedTx = tx.signTxn(this.wallet.sk)
      const { txId } = await this.client.sendRawTransaction(signedTx).do()
      const result = await waitForConfirmation(this.client, txId, 4)
      console.log(result, txId)
      return { success: true, description: result?.['confirmed-round'] }
    } catch (err: any) {
      console.log(err)
      return {
        success: false,
        description: `Transaction Failed: ${
          err?.response?.body?.message ?? err
        }`,
      }
    }
  }

  public async estimateCostSendTokenTo(
    tokenAddress: string,
    receiverAddress: string,
    amount: string,
  ) {
    try {
      const assetInfo = await this.client
        .getAssetByID(Number(tokenAddress))
        .do()

      const suggestedParams = await this.client.getTransactionParams().do()
      const parsedAmount = format(
        assetInfo?.params?.decimals ?? 0,
        0,
        amount,
      ).toString()

      const tx = makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: this.wallet.addr,
        to: receiverAddress,
        assetIndex: Number(tokenAddress),
        amount: BigInt(parsedAmount),
        suggestedParams,
      })

      return await this.estimateCostOfTx(tx)
    } catch (err) {
      return { success: false, description: `Estimation Failed: ${err}` }
    }
  }
}
