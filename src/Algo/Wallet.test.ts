import { Wallet } from './Wallet'

describe('basic wallet', () => {
  const mnemonic =
    'dwarf flame deer swarm must canyon trick pond popular nut there tilt canvas barrel stereo engine nerve good embrace unique observe lady rate about apart'
  const privateKey =
    'EUJJM4VWBVEYODG5U5A63ZOAEHPBAS5QPJFKGHAZSHMD4THSIV3F6G35MXROXBCO764A24AJZP3KDNACMEY24O32CICYJZVDBXQNKSY='
  const address = 'L4NX2ZPC5OCE575YBVYATS7WUG2AEYJRVY5XUEQFQTTKGDPA2VF2BES5OQ'

  it('can generate same wallet', async () => {
    const wallet = new Wallet({
      password: 'toto',
      type: 'algo',
      rpc: 'https://testnet-api.algonode.cloud',
    })
    expect(wallet.getAddress()).toEqual(address)
    expect(wallet.getPrivateKey()).toEqual(privateKey)
    expect(wallet.getMnemonic()).toEqual(mnemonic)
  })

  it('can generate with Mnemonic', async () => {
    const wallet = new Wallet({
      type: 'algo',
      rpc: 'https://testnet-api.algonode.cloud',
      mnemonic,
    })

    expect(wallet.getAddress()).toEqual(address)
    expect(wallet.getPrivateKey()).toEqual(privateKey)
    expect(wallet.getMnemonic()).toEqual(mnemonic)
  })

  it('can generate with PrivateKey', async () => {
    const wallet = new Wallet({
      type: 'algo',
      rpc: 'https://testnet-api.algonode.cloud',
      privateKey,
    })

    expect(wallet.getAddress()).toEqual(address)
    expect(wallet.getPrivateKey()).toEqual(privateKey)
    expect(wallet.getMnemonic()).toBe(mnemonic)
  })

  it('can generate with random', async () => {
    const wallet = new Wallet({
      type: 'algo',
      rpc: 'https://testnet-api.algonode.cloud',
    })

    expect(wallet.getAddress()).toBeDefined()
    expect(wallet.getPrivateKey()).toBeDefined()
    expect(wallet.getMnemonic()).toBeDefined()
  })

  it('can getTokenInformation', async () => {
    const wallet = new Wallet({
      password: 'toto',
      type: 'algo',
      rpc: 'https://testnet-api.algonode.cloud',
    })

    expect(await wallet.getTokenInformation('37074699')).toEqual({
      name: 'USDC',
      symbol: 'USDC',
      decimals: 6,
    })
  })

  it('can getBalance', async () => {
    const wallet = new Wallet({
      password: 'toto',
      type: 'algo',
      rpc: 'https://testnet-api.algonode.cloud',
    })
    expect(await wallet.getCoinBalance()).toEqual('25.893')
  })

  it('can getTokenBalance', async () => {
    const wallet = new Wallet({
      password: 'toto',
      type: 'algo',
      rpc: 'https://testnet-api.algonode.cloud',
    })
    expect(await wallet.getTokenBalance('1270413')).toEqual('0')
  })

  it('can estimate sendCoin', async () => {
    const wallet = new Wallet({
      password: 'toto',
      type: 'algo',
      rpc: 'https://testnet-api.algonode.cloud',
    })
    const estimationResult = await wallet.estimateCostSendCoinTo(
      'N4S3XFD7ASQQZX5NCVKBOTCGRZFZ65QX747I6SRNGSY6PNEZRYATNNCBAI',
      '1',
    )
    expect(estimationResult.success).toBe(true)
    // expect(estimationResult.description).toMatch('insufficient funds')
  })

  it('can estimate sendToken', async () => {
    const wallet = new Wallet({
      password: 'toto',
      type: 'algo',
      rpc: 'https://testnet-api.algonode.cloud',
    })

    const estimationResult = await wallet.estimateCostSendTokenTo(
      '37074699',
      'N4S3XFD7ASQQZX5NCVKBOTCGRZFZ65QX747I6SRNGSY6PNEZRYATNNCBAI',
      '0.1',
    )
    expect(estimationResult.success).toBe(false)
    expect(estimationResult.description).toMatch('receiver error: must optin')
  })
})
