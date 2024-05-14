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
const l2Url = 'https://rpc.hera.jbcha.in' // 'https://rpc.hera.jbcha.in' // 'https://sepolia.optimism.io' // `https://l2-conduit-opstack-demo-nhl9xsg0wg.t.conduit.xyz`
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
  let config = {
    l1ChainId: 88991, // 8899, 88991, 11155111 for Sepolia, 1 for Ethereum
    l2ChainId: 7001, // 7001, // 11155420 for OP Sepolia, 10 for OP Mainnet
    contracts: {
      l1: {
        AddressManager: '0x43791148430812864D903fD4eB75e798665AcFc8',
        BondManager: '0x0000000000000000000000000000000000000000',
        CanonicalTransactionChain: '0x0000000000000000000000000000000000000000',
        L1CrossDomainMessenger: '0x4250A8AF9ceDa0bDdF5Fd3568330b6ce6310bE58',
        L1StandardBridge: '0x3C91efB30c55FbD5782be4BbA3D9628C1074a18D',
        L2OutputOracle: '0x74Ad6E0FB793eB5e6c1ff1225B03F5C5fFB7EF0c',
        OptimismPortal: '0xEcA3B962eC275d4bA8BbE0500aC6d4086c6CE039',
        StateCommitmentChain: '0x0000000000000000000000000000000000000000'
      },
      l2: {}
    },
/*
https://github.com/nidz-the-fact/op-stack-bridge-Testing-erc20-to-native/blob/master/.example.env
# Istance - erc20
REACT_APP_L1_USDT=0x39BE211eAb65e05ba98af949d3e16F7A1683d94E
REACT_APP_L2_USDT=0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000
# 0x39BE211eAb65e05ba98af949d3e16F7A1683d94E
# 0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000
# 0x110648bc41CC74229a296C77c10e48742D6Db6EE
# 0xe8Cc4515799792E91EaE08184Cd33b45c6685Cc8
*/
    bridges: {
      Standard: {
        Adapter: optimismSDK.StandardBridgeAdapter,
        l1Bridge: '0x3C91efB30c55FbD5782be4BbA3D9628C1074a18D',
        l2Bridge: '0x4200000000000000000000000000000000000010'
      },
      ETH: {
        Adapter: optimismSDK.ETHBridgeAdapter,
        l1Bridge: '0x3C91efB30c55FbD5782be4BbA3D9628C1074a18D',
        l2Bridge: '0x4200000000000000000000000000000000000010'
      }
    },
    bedrock: true
  }
  // console.log(config)  
  config.l1SignerOrProvider = l1Signer
  config.l2SignerOrProvider = l2Signer
  
  // console.log(config)
    
  crossChainMessenger = new optimismSDK.CrossChainMessenger(config)
}    // setup

const gwei = BigInt(1e18) // BigInt(50000000) // L1:49, 993,556,534, 965,141,001
// const eth = gwei * gwei   // 10^18
// const centieth = eth/100n


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
    await depositETH()
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