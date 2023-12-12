

interface  BlockSpaceOptions {
  isEnabled?: boolean;
  commitMode?: 'immediate' | 'lazy' | 'manual';
  lazyCommitInterval?: number;
}

const blockspaceOptions : BlockSpaceOptions = {
    isEnabled: true,
    commitMode: 'manual',
}

const network = Mina.Network({
  mina: TESTWORLD2,
  archive: TESTWORLD2_ARCHIVE,
  blockspaceOptions
});
Mina.setActiveInstance(network);

// first transatcion
const transaction1 = await Mina.transaction(
  { sender, fee },
  () => {
    zkApp.addVoteToMerkleTree(...);
  }

// second transaction
const calculatedState = transaction1.calculateState();
const transaction2 = await Mina.transaction(
  { sender, fee, state: calculatedState },
  () => {
    zkApp.addVoteToMerkleTree(...);
  }
await transaction1.prove();
await transaction1.sign(...).send();
await transaction1.prove();
await transaction1.sign(...).send();
const guaranteedState = await blockSpace.commit(); 
const transaction3 = await Mina.transaction(
  { sender, fee, state: guaranteedState },
  () => {
    zkApp.addVoteToMerkleTree(...);
  }
  await transaction3.prove();
  await transaction3.sign(...).send();
  await blockspaceOptions.close(); // commit and close block space 