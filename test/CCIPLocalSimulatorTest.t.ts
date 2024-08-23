import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { local } from "../typechain-types/@chainlink";

describe("CCIPLocalSimulator Contract", function () {
    let localSimulator: any;
    let ccnsRegister: any;
    let ccnsReceiver: any;
    let ccnsLookupSource: any;
    let ccnsLookupReceiver: any;
    let config: any;
    // let aliceAddress: string;
    let aliceName: String;

    before(async function () {
        // Step 1: Deploy CCIPLacolSimulator
        console.log("Deploying the CCIPLocalSimulator Contract...");
        const CCIPLocalSimulatorFactory = await ethers.getContractFactory("CCIPLocalSimulator");
        localSimulator = await CCIPLocalSimulatorFactory.deploy();
        await localSimulator.deployed();
        console.log("CCIPLocalSimulator deployed to:", localSimulator.address);

        // Step 2: Get configuration from CCIPLocalSimulator
        console.log("Deploying the Router Contract...");
        config = await localSimulator.configuration();
        console.log("Router contract address:", config.sourceRouter_);

        // Step 3: Deploy (Create Instances) CrossChainNameServiceRegister.sol
        console.log("Deploying the CrossChainNameSerivceRegister...");
        const CCNSRegisterFactory = await ethers.getContractFactory("CrossChainNameServiceRegister");
        ccnsRegister = await CCNSRegisterFactory.deploy(config.sourceRouter_, "0x603E1BD79259EbcbAaeD0c83eeC09cA0B89a5bcC");
        await ccnsRegister.deployed();
        console.log("CrossChainNameServiceRegister deployed to:", ccnsRegister.address);

        // Step 4: Deploy CrossChainNameServiceReceiver.sol
        console.log("Deploying the CrossChainNameServiceReceiver...");
        const CCNSReceiverFactory = await ethers.getContractFactory("CrossChainNameServiceReceiver");
        ccnsReceiver = await CCNSReceiverFactory.deploy(config.sourceRouter_, config.sourceRouter_, config.chainSelector_.toString());
        await ccnsReceiver.deployed();
        console.log("CrossChainNameServiceReceiver deployed tp:", ccnsReceiver.address);

        // Step 5: Deploy CrossChainNameServiceLookup.sol (source)
        console.log("Deploying the CrossChainNameServiceLookup (Source)...");
        const CCNSLookupFactory = await ethers.getContractFactory("CrossChainNameServiceLookup");
        ccnsLookupSource = await CCNSLookupFactory.deploy();
        await ccnsLookupSource.deployed();
        console.log("CrossChainNameServiceLookup (source) deployed to:", ccnsLookupSource.address);

        // Step 5b: Deploy CrossChainNameServiceLookup.sol (receiver)
        console.log("Deploying the CrossChainNameServiceLookup (receiver)");
        ccnsLookupReceiver = await CCNSLookupFactory.deploy();
        await ccnsLookupReceiver.deployed();
        console.log("CrossChainNameServiceLookup (receiver) deployed to:", ccnsLookupReceiver.address);

        // Step 6: Enable chains on CrossChainNameServiceRegister and CrossChainNameServiceReceiver
        const xNftAddress = ethers.constants.AddressZero;
        const ccipExtraArgs = ethers.utils.formatBytes32String("");

        console.log("Step 6: Enabling chain on CrossChainNameServiceRegister...");
        await ccnsRegister.enableChain(config.chainSelector_.toString(), xNftAddress, ccipExtraArgs);
        console.log("Step 6: Config Chain Selector (string):", config.chainSelector_.toString());

        // Step 7: Set CrossChainNameService addresses in the lookup contracts
        console.log("Step 7: Setting CrossChainNameService address in CCNSLookup (source)...");
        await ccnsLookupSource.setCrossChainNameServiceAddress(ccnsRegister.address);
        console.log("Step 7: The ccnsLookupSource (source) address:", ccnsRegister.address);

        console.log("Step 7a: Setting CrossChainNameService address in CCNSLookup (receiver)...");
        await ccnsLookupReceiver.setCrossChainNameServiceAddress(ccnsReceiver.address);
        console.log("Step 7a: The ccnsLookupReceiver (receiver) address", ccnsReceiver.address);
    })

    it("Should deploy the CCIPLocalSimulator contract and fetch configuration", async function () {
        expect(localSimulator.address).to.properAddress;
        expect(config.sourceRouter_).to.properAddress;
    });

    it("Should register and lookup Alice's CCNS correctly", async function () {
        try {
            const alicePrivateKey = "PRIVATE_KEY"; // removed even though it was a Dummy key.
            const aliceSigner = new ethers.Wallet(alicePrivateKey, ethers.provider);
            console.log("This is Alice Signer address:", aliceSigner.address);
            const [deployer] = await ethers.getSigners();
            // console.log(deployer);
            const aliceName = "alice.ccns";
            const aliceAddress = aliceSigner.address;
            const amount = ethers.utils.parseEther("10");

            // Fund Alice account
            const txa = await deployer.sendTransaction({
                to: aliceAddress,
                value: amount
            });
            await txa.wait();

            console.log("Alice CCNS name:", aliceName);
            console.log("Registering with name:", aliceName);
            console.log("Registering with Alice's address:", aliceAddress);

            // Checking Alice account balance:
            const balance = await aliceSigner.getBalance();
            console.log(`Alice's balance: ${ethers.utils.formatEther(balance)} Ether`);
            console.log("Provider network:", await ethers.provider.getNetwork());

            // Step 8: Register Alice's CCNS
            console.log("Step 8: Registering Alice's CCNS...");
            const registerTx = await ccnsRegister.connect(aliceSigner).register(aliceAddress);
            await registerTx.wait();
            console.log(`Successfully registered ${aliceName} with address ${aliceAddress}`);
            
             // Step 9: Lookup Alice's CCNS
            console.log("Step 9: Looking up Alice's CCNS...");
            const lookedUpAddress = await ccnsLookupReceiver.lookup(aliceAddress);

            // Step 10: Assert that the looked-up address matches Alice's EOA address
            expect(lookedUpAddress).to.equal(aliceAddress);
        } catch (error) {
            console.error("Error during registration:", error);
        }
    });
});
