import {
  Field,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  Poseidon,
  SmartContract,
} from "o1js";

import { MinaNFTStateProof, MinaNFTState } from "./map";
import { RedactedMinaNFTMapStateProof } from "./redactedmap";

/**
 * class MinaNFTContract
 *
 * ```mermaid
 *  classDiagram
 *   class MinaNFT{
 *       name
 *       publicAttributesRoot
 *       publicObjectsRoot
 *       privateAttributesRoot
 *       privateObjectsRoot
 *       uri1
 *       uri2
 *       pwdHash
 *   }
 *   class uri{
 *       storage hash
 *   }
 *   class PrivateMerkleMap{
 *       key : value
 *   }
 *   class PublicMerkleMap{
 *       key : value
 *   }
 *   class PublicObjects{
 *     type (map, string, file)
 *     filename
 *     size
 *     mime-type
 *     sha2-256
 *     sha3-512
 *     MerkleTree root
 *   }
 *   class PrivateObjects{
 *     type (map, string, file)
 *     filename
 *     size
 *     mime-type
 *     sha2-256
 *     sha3-512
 *     powerToAddPublicData
 *     powerToAddPublicFiles
 *     powerToAddPrivateData
 *     powerToAddPrivateFiles
 *     powerToChangePassword
 *     powerToVerify
 *     MerkleTree root
 *   }
 *   class PublicObjectsMerkleTree{
 *     [file data]
 *   }
 *   class PrivateObjectsMerkleTree{
 *     [file data]
 *   }
 *   MinaNFT "uri1" --> uri : uri1
 *   MinaNFT "uri2" --> uri : uri2
 *   MinaNFT "publicAttributesRoot" --> PublicMerkleMap : publicAttributesRoot
 *   MinaNFT "privateAttributesRoot" --> PrivateMerkleMap : privateAttributesRoot
 *   uri --> IPFS
 *   uri --> Arweave
 *   PublicObjects "MerkleTree root" --> PublicObjectsMerkleTree : MerkleTree root
 *   MinaNFT "publicObjectsRoot" --> PublicObjects
 *   PrivateObjects "MerkleTree root" --> PrivateObjectsMerkleTree : MerkleTree root
 *   MinaNFT "privateObjectsRoot" --> PrivateObjects
 * ```
 */

export class MinaNFTContract extends SmartContract {
  @state(Field) name = State<Field>();
  @state(Field) publicAttributesRoot = State<Field>(); // Merkle root of public key-values attributes Map
  @state(Field) publicObjectsRoot = State<Field>(); // Merkle root of public Objects Map
  @state(Field) privateAttributesRoot = State<Field>(); // Merkle root of private key-values attributes Map
  @state(Field) privateObjectsRoot = State<Field>(); // Merkle root of private Objects Map
  // URI format: i:IPFS_HASH or a:ARWEAVE_HASH, converted to Field[2]
  @state(Field) uri1 = State<Field>(); // First part of uri hash converted from string to Field
  @state(Field) uri2 = State<Field>(); // Second part of uri hash converted from string to Field
  @state(Field) pwdHash = State<Field>(); // Hash of password used to prove transactions

  events = {
    mint: Field,
    update: MinaNFTState,
    changePassword: Field,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      setPermissions: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
    this.emitEvent("mint", Field(0));
  }

  @method update(secret: Field, proof: MinaNFTStateProof) {
    this.pwdHash.assertEquals(this.pwdHash.get());
    this.pwdHash.assertEquals(Poseidon.hash([secret]));

    const publicAttributesRoot: Field = this.publicAttributesRoot.get();
    this.publicAttributesRoot.assertEquals(publicAttributesRoot);

    const publicObjectsRoot: Field = this.publicObjectsRoot.get();
    this.publicObjectsRoot.assertEquals(publicObjectsRoot);

    const privateAttributesRoot: Field = this.privateAttributesRoot.get();
    this.privateAttributesRoot.assertEquals(privateAttributesRoot);

    const privateObjectsRoot: Field = this.privateObjectsRoot.get();
    this.privateObjectsRoot.assertEquals(privateObjectsRoot);

    proof.publicInput.publicAttributes.initialRoot.assertEquals(
      publicAttributesRoot
    );
    proof.publicInput.publicObjects.initialRoot.assertEquals(publicObjectsRoot);
    proof.publicInput.privateAttributes.initialRoot.assertEquals(
      privateAttributesRoot
    );
    proof.publicInput.privateObjects.initialRoot.assertEquals(
      privateObjectsRoot
    );

    proof.verify();

    this.publicAttributesRoot.set(
      proof.publicInput.publicAttributes.latestRoot
    );
    this.publicObjectsRoot.set(proof.publicInput.publicObjects.latestRoot);
    this.privateAttributesRoot.set(
      proof.publicInput.privateAttributes.latestRoot
    );
    this.privateObjectsRoot.set(proof.publicInput.privateObjects.latestRoot);
    this.emitEvent("update", proof.publicInput);
  }
  /*
  @method verifyPublicAttributes(proof: RedactedMinaNFTMapStateProof) {
    const publicAttributesRoot: Field = this.publicAttributesRoot.get();
    this.publicAttributesRoot.assertEquals(publicAttributesRoot);

    proof.publicInput.originalRoot.assertEquals(publicAttributesRoot);

    proof.verify();
  }

  @method verifyPrivateAttributes(proof: RedactedMinaNFTMapStateProof) {
    const privateAttributesRoot: Field = this.privateAttributesRoot.get();
    this.privateAttributesRoot.assertEquals(privateAttributesRoot);

    proof.publicInput.originalRoot.assertEquals(privateAttributesRoot);

    proof.verify();
  }

 
  @method verify(proof: RedactedMinaNFTStateProof) {
    const publicAttributesRoot: Field = this.publicAttributesRoot.get();
    this.publicAttributesRoot.assertEquals(publicAttributesRoot);

    const publicObjectsRoot: Field = this.publicObjectsRoot.get();
    this.publicObjectsRoot.assertEquals(publicObjectsRoot);

    const privateAttributesRoot: Field = this.privateAttributesRoot.get();
    this.privateAttributesRoot.assertEquals(privateAttributesRoot);

    const privateObjectsRoot: Field = this.privateObjectsRoot.get();
    this.privateObjectsRoot.assertEquals(privateObjectsRoot);

    proof.publicInput.publicAttributes.originalRoot.assertEquals(
      publicAttributesRoot
    );
    proof.publicInput.publicObjects.originalRoot.assertEquals(
      publicObjectsRoot
    );
    proof.publicInput.privateAttributes.originalRoot.assertEquals(
      privateAttributesRoot
    );
    proof.publicInput.privateObjects.originalRoot.assertEquals(
      privateObjectsRoot
    );

    proof.verify();
  }
*/

  // Change password
  @method changePassword(secret: Field, newsecret: Field) {
    this.pwdHash.assertEquals(this.pwdHash.get());
    this.pwdHash.assertEquals(Poseidon.hash([secret]));

    this.pwdHash.set(Poseidon.hash([newsecret]));
    this.emitEvent("changePassword", newsecret);
  }
}

//TODO: upgrade function

// TODO: approve function

// TODO: add verifyer function

// TODO: updateVerifiedInfo function

// TODO: nullifiers for approve and verifyer functions

/*
  @method init() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertFalse();

    super.init();
  }

  // Create NFT on the MINA blockchain

  @method mint(
    name: Field,
    publicAttributesRoot: Field,
    publicObjectsRoot: Field,
    privateAttributesRoot: Field,
    privateObjectsRoot: Field,
    uri1: Field,
    uri2: Field,
    pwdHash: Field
  ) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const nameOld = this.name.get();
    this.name.assertEquals(nameOld);
    this.name.assertEquals(Field(0));

    const pwdHashOld = this.pwdHash.get();
    this.pwdHash.assertEquals(pwdHashOld);
    this.pwdHash.assertEquals(Field(0));

    const publicAttributesRootOld = this.publicAttributesRoot.get();
    this.publicAttributesRoot.assertEquals(publicAttributesRootOld);
    this.publicAttributesRoot.assertEquals(Field(0));

    const publicObjectsRootOld = this.publicObjectsRoot.get();
    this.publicObjectsRoot.assertEquals(publicObjectsRootOld);
    this.publicObjectsRoot.assertEquals(Field(0));

    const privateAttributesRootOld = this.privateAttributesRoot.get();
    this.privateAttributesRoot.assertEquals(privateAttributesRootOld);
    this.privateAttributesRoot.assertEquals(Field(0));

    const privateObjectsRootOld = this.privateObjectsRoot.get();
    this.privateObjectsRoot.assertEquals(privateObjectsRootOld);
    this.privateObjectsRoot.assertEquals(Field(0));

    const uri1Old = this.uri1.get();
    this.uri1.assertEquals(uri1Old);
    this.uri1.assertEquals(Field(0));

    const uri2Old = this.uri2.get();
    this.uri2.assertEquals(uri2Old);
    this.uri2.assertEquals(Field(0));

    this.name.set(name);
    this.publicAttributesRoot.set(publicAttributesRoot);
    this.publicObjectsRoot.set(publicObjectsRoot);
    this.privateAttributesRoot.set(privateAttributesRoot);
    this.privateObjectsRoot.set(privateObjectsRoot);
    this.uri1.set(uri1);
    this.uri2.set(uri2);
    this.pwdHash.set(pwdHash);
  }

  @method updatePublicAttributes(secret: Field, proof: MinaNFTMapProof) {
    this.account.provedState.assertEquals(this.account.provedState.get())
    this.account.provedState.get().assertTrue()

    const pwdHash = this.pwdHash.get()
    this.pwdHash.assertEquals(pwdHash)
    this.pwdHash.assertEquals(Poseidon.hash([secret]))

    const root = this.publicAttributesRoot.get()
    this.publicAttributesRoot.assertEquals(root)
    proof.publicInput.initialRoot.assertEquals(root)
    proof.verify()

    this.publicAttributesRoot.set( proof.publicInput.latestRoot) 
  }

  
  @method updatePrivateAttributes(secret: Field, proof: MinaNFTMapProof) {
    this.account.provedState.assertEquals(this.account.provedState.get())
    this.account.provedState.get().assertTrue()

    const pwdHash = this.pwdHash.get()
    this.pwdHash.assertEquals(pwdHash)
    this.pwdHash.assertEquals(Poseidon.hash([secret]))

    const root = this.privateAttributesRoot.get()
    this.privateAttributesRoot.assertEquals(root)
    proof.publicInput.initialRoot.assertEquals(root)
    proof.verify()

    this.privateAttributesRoot.set( proof.publicInput.latestRoot) 
  }


  @method verifyMapWitness(state: Field, key: Field, value: Field, merkleMapWitness: MerkleMapWitness) {
    const [witnessRoot, witnessKey] = merkleMapWitness.computeRootAndKey(value)
    witnessRoot.assertEquals(state)
    witnessKey.assertEquals(key)
  }


  @method verifyMapProof(state: Field, minaNFTStateProof: MinaNFTMapProof) {
    minaNFTStateProof.publicInput.initialRoot.assertEquals(state)
    minaNFTStateProof.verify()
  }


  @method verifyTreeWitness(state: Field, index: Field, value: Field, merkleTreeWitness: MerkleWitness10) {
    const witnessRoot = merkleTreeWitness.calculateRoot(value)
    const calculatedIndex = merkleTreeWitness.calculateIndex()
    witnessRoot.assertEquals(state)
    calculatedIndex.assertEquals(index)
  }


  @method verifyTreeProof(state: Field, minaNFTTreeProof: MinaNFTTreeProof) {
    minaNFTTreeProof.publicInput.root.assertEquals(state);
    minaNFTTreeProof.verify();
  }

  // Make a post - TODO rewrite using new merkle roots structure
  
    @method post(salt: Field, secret: Field, postsRoot: Field) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();

        const pwdHash = this.pwdHash.get();
        this.pwdHash.assertEquals(pwdHash);
        this.pwdHash.assertEquals(Poseidon.hash([salt, secret]));

        // TODO add checks and proofs
        this.postsRoot.set(postsRoot);
    }
    

  // Change password
  @method changePassword(salt: Field, secret: Field, newsecret: Field) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const pwdHash = this.pwdHash.get();
    this.pwdHash.assertEquals(pwdHash);
    this.pwdHash.assertEquals(Poseidon.hash([salt, secret]));

    this.pwdHash.set(Poseidon.hash([salt, newsecret]));
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method setPublicKeyValue() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method setPublicFile() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method setPrivateKeyValue() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method setPrivateFile() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method checkPublicKeyValue() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method checkPrivateKeyValue() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method checkPublicFile() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method checkPrivateFile() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }


    // put NFT to escrow before the transfer in case NFT is sold for fiat money
    // TODO - rewrite using privateAttributesRoot
    @method toEscrow(secret: Field, escrowhash: Field) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();

        const pwd = this.pwd.get();
        this.pwd.assertEquals(pwd);
        this.pwd.assertEquals(
            Poseidon.hash([Field.fromJSON(NFT_SALT), secret]),
        );

        const nonce = this.nonce.get();
        this.nonce.assertEquals(nonce);
        this.nonce.set(nonce.add(Field(1)));

        this.escrow.assertEquals(Field(0));
        this.escrow.set(escrowhash);
    }

    // get NFT from escrow in case NFT is sold for fiat money
    @method fromEscrow(newsecret: Field, escrowSecret: Field) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();

        const escrow = this.escrow.get();
        this.escrow.assertEquals(escrow);
        this.escrow.assertEquals(
            Poseidon.hash([Field.fromJSON(NFT_SALT), escrowSecret]),
        );

        const nonce = this.nonce.get();
        this.nonce.assertEquals(nonce);
        this.nonce.set(nonce.add(Field(1)));

        this.pwd.set(Poseidon.hash([Field.fromJSON(NFT_SALT), newsecret]));
    }

    // Change username - TODO - rewrite using salt and secret
    @method changeUsername(secret: Field, username: Field) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();

        const pwd = this.pwd.get();
        this.pwd.assertEquals(pwd);
        this.pwd.assertEquals(
            Poseidon.hash([Field.fromJSON(NFT_SALT), secret]),
        );

        const nonce = this.nonce.get();
        this.nonce.assertEquals(nonce);
        this.nonce.set(nonce.add(Field(1)));

        this.username.set(username);
    }
*/
