#! /usr/local/bin/node

// Transfers between L1 and L2 using the Optimism SDK

const ethers = require("ethers")
const optimismSDK = require("@eth-optimism/sdk")
// const conduitSDK = require('@conduitxyz/sdk');
require('dotenv').config()

// Network information and utilities for this example network are available
// here: https://app.conduit.xyz/published/view/conduit-opstack-demo-nhl9xsg0wg

// Your settlment layer rpc url here
const l1Url = 'https://rpc.testnet.jibchain.net' // 'https://rpc.jibchain.net' 'https://rpc.testnet.jibchain.net' // `https://eth-goerli.public.blastapi.io`
// Your conduit rpc url here
const l2Url = 'https://sepolia.optimism.io' // 'https://rpc.hera.jbcha.in' // 'https://sepolia.optimism.io' // `https://l2-conduit-opstack-demo-nhl9xsg0wg.t.conduit.xyz`
const privateKey = process.env.PRIVATE_KEY

// Global variable because we need them almost everywhere
let crossChainMessenger
let addr    // Our address

const getSigners = async () => {
    const l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)
    const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
    const l1Wallet = new ethers.Wallet(privateKey, l1RpcProvider)
    const l2Wallet = new ethers.Wallet(privateKey, l2RpcProvider)

    // console.log(l1RpcProvider)
    // console.log(l2RpcProvider)
    // console.log(l1Wallet)
    // console.log(l2Wallet)

    return [l1Wallet, l2Wallet]
}   // getSigners

const setup = async() => {
  const [l1Signer, l2Signer] = await getSigners()

  addr = l1Signer.address
  // The network slug is available in the Network Information tab here: https://app.conduit.xyz/published/view/conduit-opstack-demo-3druhsesa1
  // let config = await conduitSDK.getOptimismConfiguration('conduit:zora-sepolia-0thyhxtf5e');
  // config.l1SignerOrProvider = l1Signer
  // config.l2SignerOrProvider = l2Signer
  
  // console.log(config)
    
  // crossChainMessenger = new optimismSDK.CrossChainMessenger(config)

  crossChainMessenger = new optimismSDK.CrossChainMessenger({
    l1ChainId: 88991, // 8899, 88991, 11155111 for Sepolia, 1 for Ethereum
    l2ChainId: 11155420, // 7001, // 11155420 for OP Sepolia, 10 for OP Mainnet
    // contracts: {
    //   l1: {
    //     // AddressManager: '0x27c9392144DFcB6dab113F737356C32435cD1D55',
    //     // BondManager: '0x0000000000000000000000000000000000000000',
    //     // CanonicalTransactionChain: '0x0000000000000000000000000000000000000000',
    //     // L1CrossDomainMessenger: '0x1bDBC0ae22bEc0c2f08B4dd836944b3E28fe9b7A',
    //     // L1StandardBridge: '0x5376f1D543dcbB5BD416c56C189e4cB7399fCcCB',
    //     // L2OutputOracle: '0x2615B481Bd3E5A1C0C7Ca3Da1bdc663E8615Ade9',
    //     // OptimismPortal: '0xeffE2C6cA9Ab797D418f0D91eA60807713f3536f',
    //     // StateCommitmentChain: '0x0000000000000000000000000000000000000000'
    //   },
    //   l2: {}
    // },
    // bridges: {
    //   Standard: {
    //     Adapter: [class StandardBridgeAdapter],
    //     l1Bridge: '0x5376f1D543dcbB5BD416c56C189e4cB7399fCcCB',
    //     l2Bridge: '0x4200000000000000000000000000000000000010'
    //   },
    //   ETH: {
    //     Adapter: [class ETHBridgeAdapter extends StandardBridgeAdapter],
    //     l1Bridge: '0x5376f1D543dcbB5BD416c56C189e4cB7399fCcCB',
    //     l2Bridge: '0x4200000000000000000000000000000000000010'
    //   }
    // },
    // bedrock: true,    
    l1SignerOrProvider: l1Signer,
    l2SignerOrProvider: l2Signer,
  })

  console.log(l1Signer)
  console.log(l2Signer)  

  console.log(crossChainMessenger)

}    // setup

const gwei = BigInt(1e9)
const eth = gwei * gwei   // 10^18
const centieth = eth/100n


const reportBalances = async () => {
  const l1Balance = (await crossChainMessenger.l1Signer.getBalance()).toString().slice(0,-9)
  const l2Balance = (await crossChainMessenger.l2Signer.getBalance()).toString().slice(0,-9)

  console.log(`On L1:${l1Balance} Gwei    On L2:${l2Balance} Gwei`)
}    // reportBalances


const depositETH = async () => {

  console.log("Deposit ETH")
  await reportBalances()
  const start = new Date()

  const response = await crossChainMessenger.depositETH(gwei, {
  })
  console.log(`Transaction hash (on L1): ${response.hash}`)
  await response.wait()
  console.log("Waiting for status to change to RELAYED")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response.hash,
                                                  optimismSDK.MessageStatus.RELAYED)

  await reportBalances()
  console.log(`depositETH took ${(new Date()-start)/1000} seconds\n\n`)
}     // depositETH()

const withdrawETH = async () => { 
  console.log("Withdraw ETH")
  const start = new Date()  
  await reportBalances()

  const response = await crossChainMessenger.withdrawETH(gwei)
  console.log(`Transaction hash (on L2): ${response.hash}`)
  await response.wait()

  console.log("Waiting for status to be READY_TO_PROVE")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response.hash, 
    optimismSDK.MessageStatus.READY_TO_PROVE)
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)  
  await crossChainMessenger.proveMessage(response.hash)

  console.log("In the challenge period, waiting for status READY_FOR_RELAY") 
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)  
  await crossChainMessenger.waitForMessageStatus(response.hash, 
                                                optimismSDK.MessageStatus.READY_FOR_RELAY) 
  console.log("Ready for relay, finalizing message now")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)  
  await crossChainMessenger.finalizeMessage(response)
  console.log("Waiting for status to change to RELAYED")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)  
  await crossChainMessenger.waitForMessageStatus(response, 
    optimismSDK.MessageStatus.RELAYED)
  await reportBalances()   
  console.log(`withdrawETH took ${(new Date()-start)/1000} seconds\n\n\n`)  
}     // withdrawETH()


const main = async () => {
    await setup()
    await reportBalances()
    // await depositETH()
    // await withdrawETH()
}  // main



main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })


/*

C:\temp\optimism-tutorial\cross-dom-bridge-eth-MMM>node index_0_jibchainTestnet.js
Error: cannot get contract AddressManager for unknown L2 chain ID 7001, you must provide an address
    at getOEContract (C:\temp\optimism-tutorial\cross-dom-bridge-eth-MMM\node_modules\.pnpm\@eth-optimism+sdk@3.3.0_ethers@5.7.2\node_modules\@eth-optimism\sdk\dist\utils\contracts.js:104:19)
    at getAllOEContracts (C:\temp\optimism-tutorial\cross-dom-bridge-eth-MMM\node_modules\.pnpm\@eth-optimism+sdk@3.3.0_ethers@5.7.2\node_modules\@eth-optimism\sdk\dist\utils\contracts.js:137:63)
    at new CrossChainMessenger (C:\temp\optimism-tutorial\cross-dom-bridge-eth-MMM\node_modules\.pnpm\@eth-optimism+sdk@3.3.0_ethers@5.7.2\node_modules\@eth-optimism\sdk\dist\cross-chain-messenger.js:230:56) 
    at setup (C:\temp\optimism-tutorial\cross-dom-bridge-eth-MMM\index_0_jibchainTestnet.js:50:25)      
    at async main (C:\temp\optimism-tutorial\cross-dom-bridge-eth-MMM\index_0_jibchainTestnet.js:155:5) 

*/