import { MinaNFT } from "./src/minanft";

async function main() {
    await MinaNFT.minaInit();
    const nft = new MinaNFT();

    nft.publicData.set("name", "@test");
    nft.publicData.set("description", "my nft @test");
    nft.publicData.set("image", "https/ipfs.io/ipfs/Qm...");

    nft.privateData.set("name", "cohort2");

    const publicJson = await nft.getPublicJson();
    console.log("publicJson", publicJson);

    const privateJson = await nft.getPrivateJson();
    console.log("privateJson", privateJson);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
