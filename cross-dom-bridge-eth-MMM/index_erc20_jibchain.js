#! /usr/local/bin/node

// ERC-20 transfers between L1 and L2 using the Optimism SDK

const ethers = require("ethers")
const optimismSDK = require("@eth-optimism/sdk")
require('dotenv').config()

// https://raw.githubusercontent.com/nidz-the-fact/op-stack-bridge-Testing-erc20-to-native/master/.example.env
// https://raw.githubusercontent.com/nidz-the-fact/Edit-code-Testing-erc20-to-native/main/Deposit.js
// https://exp.testnet.jibchain.net
// https://exp.hera.jbcha.in

// Your settlment layer rpc url here
const l1Url = 'https://rpc.testnet.jibchain.net'
const l2Url = 'https://rpc.hera.jbcha.in'
const privateKey = process.env.PRIVATE_KEY

// Contract addresses for L1TKN tokens, taken
const erc20Addrs = {
  l1Addr: "0x39BE211eAb65e05ba98af949d3e16F7A1683d94E",
  l2Addr: "0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000"
}    // erc20Addrs

// Global variable because we need them almost everywhere
let crossChainMessenger
let l1ERC20, l2ERC20    // L1TKN contracts to show ERC-20 transfers
let l1ERC20_approve, l2ERC20_depositERC20Transaction
let ourAddr             // The address of the signer we use.  

const getSigners = async () => {
    const l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)
    const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
    const l1Wallet = new ethers.Wallet(privateKey, l1RpcProvider)
    const l2Wallet = new ethers.Wallet(privateKey, l2RpcProvider)

    return [l1Wallet, l2Wallet]
}   // getSigners



// The ABI fragment for the contract. We only need to know how to do two things:
// 1. Get an account's balance
// 2. Call the faucet to get more (only works on L1). Of course, production 
//    ERC-20 tokens tend to be a bit harder to acquire.
const erc20ABI = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  // faucet
  {
    inputs: [],
    name: "faucet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
]    // erc20ABI



const setup = async() => {
  const [l1Signer, l2Signer] = await getSigners()
  ourAddr = l1Signer.address

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

  crossChainMessenger = new optimismSDK.CrossChainMessenger(config)  

  l1ERC20 = new ethers.Contract(erc20Addrs.l1Addr, erc20ABI, l1Signer)
  l2ERC20 = new ethers.Contract(erc20Addrs.l2Addr, erc20ABI, l2Signer)

  l1ERC20_approve = new ethers.Contract(erc20Addrs.l1Addr, ['function approve(address spender, uint256 amount) returns (bool)'], l1Signer)
  l2ERC20_depositERC20Transaction = new ethers.Contract("0x0d605bb7d4FB586eAB750205F5247825F4D8AF4B", ['function depositERC20Transaction(address _to, uint256 _mint, uint256 _value, uint64 _gasLimit, bool _isCreation, bytes memory _data)'], l1Signer)
  // 0xEcA3B962eC275d4bA8BbE0500aC6d4086c6CE039, 0x0d605bb7d4FB586eAB750205F5247825F4D8AF4B
}    // setup



const reportERC20Balances = async () => {
  const l1Balance = (await l1ERC20.balanceOf(ourAddr)).toString().slice(0,-18)
  const l2Balance = (await crossChainMessenger.l2Signer.getBalance()).toString().slice(0,-18)
  // const l2Balance = 0 // (await l2ERC20.balanceOf(ourAddr)).toString().slice(0,-18)
  console.log(`L1TKN on L1:${l1Balance}     L1TKN on L2:${l2Balance}`)

  if (l1Balance != 0) {
    return
  }

  console.log(`You don't have enough L1TKN on L1. Let's call the faucet to fix that`)
  const tx = (await l1ERC20.faucet())
  console.log(`Faucet tx: ${tx.hash}`)
  console.log(`\tMore info: https://exp.testnet.jibchain.net/tx/${tx.hash}`)
  await tx.wait()
  const newBalance = (await l1ERC20.balanceOf(ourAddr)).toString().slice(0,-18)
  console.log(`New L1 L1TKN balance: ${newBalance}`)
}    // reportERC20Balances




const oneToken = BigInt(10*1e18)


const depositERC20 = async () => {

  console.log("Deposit ERC20")
  await reportERC20Balances()
  const start = new Date()

  const allowanceResponse = await l1ERC20_approve.approve(
    "0x0d605bb7d4FB586eAB750205F5247825F4D8AF4B", oneToken)
  await allowanceResponse.wait()
  console.log(`Allowance given by tx ${allowanceResponse.hash}`)
  console.log(`\tMore info: https://exp.testnet.jibchain.net/tx/${allowanceResponse.hash}`)
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)

  const gasLimit = 3000000; // gas limit (fix - 3000000 (90% +))
  const isCreation = false; // fix - false
  const data = ethers.utils.hexlify('0x00'); // data (fix - 0=+)

  const response = await l2ERC20_depositERC20Transaction.depositERC20Transaction( 
    ourAddr, oneToken, oneToken, gasLimit, isCreation, data)
  console.log(`Deposit transaction hash (on L1): ${response.hash}`)
  console.log(`\tMore info: https://exp.testnet.jibchain.net/tx/${response.hash}`)
  await response.wait()
  console.log("Waiting for status to change to RELAYED")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  // await crossChainMessenger.waitForMessageStatus(response.hash,
  //                                                 optimismSDK.MessageStatus.RELAYED)

  await reportERC20Balances()
  console.log(`depositERC20 took ${(new Date()-start)/1000} seconds\n\n`)
}     // depositERC20()



const withdrawERC20 = async () => {

  console.log("Withdraw ERC20")
  const start = new Date()
  await reportERC20Balances()

  const response = await crossChainMessenger.withdrawERC20(
    erc20Addrs.l1Addr, erc20Addrs.l2Addr, oneToken)
  console.log(`Transaction hash (on L2): ${response.hash}`)
  console.log(`\tFor more information: https://exp.hera.jbcha.in/tx/${response.hash}`)
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
  await crossChainMessenger.finalizeMessage(response.hash)

  console.log("Waiting for status to change to RELAYED")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)  
  await crossChainMessenger.waitForMessageStatus(response, 
    optimismSDK.MessageStatus.RELAYED)
  await reportERC20Balances()   
  console.log(`withdrawERC20 took ${(new Date()-start)/1000} seconds\n\n\n`)  
}     // withdrawERC20()




const main = async () => {
    await setup()
    await reportERC20Balances()
    // await depositERC20()
    // await withdrawERC20()
}  // main



main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })





