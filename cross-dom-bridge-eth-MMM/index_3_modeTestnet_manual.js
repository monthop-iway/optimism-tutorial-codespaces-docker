#! /usr/local/bin/node

// Transfers between L1 and L2 using the Optimism SDK

const ethers = require("ethers")
const optimismSDK = require("@eth-optimism/sdk")
const conduitSDK = require('@conduitxyz/sdk');
require('dotenv').config()

// Network information and utilities for this example network are available
// here: https://app.conduit.xyz/published/view/conduit-opstack-demo-nhl9xsg0wg

// Your settlment layer rpc url here
const l1Url = 'https://rpc.ankr.com/eth_sepolia' // `https://eth-goerli.public.blastapi.io`
// Your conduit rpc url here
const l2Url = 'https://sepolia.rpc.zora.energy' // `https://l2-conduit-opstack-demo-nhl9xsg0wg.t.conduit.xyz`
const privateKey = process.env.PRIVATE_KEY

// Global variable because we need them almost everywhere
let crossChainMessenger
let addr    // Our address

const getSigners = async () => {
    const l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)
    const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
    const l1Wallet = new ethers.Wallet(privateKey, l1RpcProvider)
    const l2Wallet = new ethers.Wallet(privateKey, l2RpcProvider)

    //console.log(l1RpcProvider)
    //console.log(l2RpcProvider)
    //console.log(l1Wallet)
    //console.log(l2Wallet)

    return [l1Wallet, l2Wallet]
}   // getSigners

const setup = async() => {
  const [l1Signer, l2Signer] = await getSigners()
  addr = l1Signer.address
  // The network slug is available in the Network Information tab here: https://app.conduit.xyz/published/view/conduit-opstack-demo-3druhsesa1
  // let config = await conduitSDK.getOptimismConfiguration('conduit:mode-sepolia-vtnhnpim72');
  let config = {
    l1ChainId: '11155111',
    l2ChainId: '919',
    contracts: {
      l1: {
        AddressManager: '0x83D45725d6562d8CD717673D6bb4c67C07dC1905',
        BondManager: '0x0000000000000000000000000000000000000000',
        CanonicalTransactionChain: '0x0000000000000000000000000000000000000000',
        L1CrossDomainMessenger: '0xc19a60d9E8C27B9A43527c3283B4dd8eDC8bE15C',
        L1StandardBridge: '0xbC5C679879B2965296756CD959C3C739769995E2',
        L2OutputOracle: '0x2634BD65ba27AB63811c74A63118ACb312701Bfa',
        OptimismPortal: '0x320e1580effF37E008F1C92700d1eBa47c1B23fD',
        StateCommitmentChain: '0x0000000000000000000000000000000000000000'
      },
      l2: {}
    },
    bridges: {
      Standard: {
        Adapter: optimismSDK.StandardBridgeAdapter, 
        l1Bridge: '0xbC5C679879B2965296756CD959C3C739769995E2',
        l2Bridge: '0x4200000000000000000000000000000000000010'
      },
      ETH: {
        Adapter: optimismSDK.ETHBridgeAdapter,
        l1Bridge: '0xbC5C679879B2965296756CD959C3C739769995E2',
        l2Bridge: '0x4200000000000000000000000000000000000010'
      }
    },
    bedrock: true
  }
  console.log(config)  
  config.l1SignerOrProvider = l1Signer
  config.l2SignerOrProvider = l2Signer

  //console.log(config)
    
  crossChainMessenger = new optimismSDK.CrossChainMessenger(config)
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





