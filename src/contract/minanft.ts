import {
  Field,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  Poseidon,
  SmartContract,
  MerkleMapWitness
} from "o1js";

import { MinaNFTMapProof } from './map'
import { MinaNFTTreeProof, MerkleWitness10 } from './tree'


/**
 * class MinaNFTContract
 * 
 * ```mermaid
 *  classDiagram
 *   class MinaNFT{
 *       name
 *       publicMapRoot
 *       publicFilesRoot
 *       privateMapRoot
 *       privateFilesRoot
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
 *   class PublicFiles{
 *     filename
 *     size
 *     mime-type
 *     sha2-256
 *     sha3-512
 *     MerkleTree root
 *   }
 *   class PrivateFiles{
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
 *   class PublicFileMerkleTree{
 *     [file data]
 *   }
 *   class PrivateFileMerkleTree{
 *     [file data]
 *   }
 *   MinaNFT "uri1" --> uri : uri1
 *   MinaNFT "uri2" --> uri : uri2
 *   MinaNFT "publicMapRoot" --> PublicMerkleMap : publicMapRoot
 *   MinaNFT "privateMapRoot" --> PrivateMerkleMap : privateMapRoot
 *   uri --> IPFS
 *   uri --> Arweave
 *   PublicFiles "MerkleTree root" --> PublicFileMerkleTree : MerkleTree root
 *   MinaNFT "publicFilesRoot" --> PublicFiles
 *   PrivateFiles "MerkleTree root" --> PrivateFileMerkleTree : MerkleTree root
 *   MinaNFT "privateFilesRoot" --> PrivateFiles   
 * ```
 */

export class MinaNFTContract extends SmartContract {
  @state(Field) name = State<Field>();
  @state(Field) publicMapRoot = State<Field>(); // Merkle root of public key-values Map
  @state(Field) publicFilesRoot = State<Field>(); // Merkle root of public Files Map
  @state(Field) privateMapRoot = State<Field>(); // Merkle root of private key-values Map
  @state(Field) privateFilesRoot = State<Field>(); // Merkle root of private Files Map
  // URI format: ipfs:IPFS_HASH or arweave:ARWEAVE_HASH
  @state(Field) uri1 = State<Field>(); // First part of uri hash converted from string to Field
  @state(Field) uri2 = State<Field>(); // Second part of uri hash converted from string to Field
  @state(Field) pwdHash = State<Field>(); // Hash of password used to prove transactions

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
  }

  @method init() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertFalse();

    super.init();
  }

  // Create NFT on the MINA blockchain

  @method mint(
    name: Field,
    publicMapRoot: Field,
    publicFilesRoot: Field,
    privateMapRoot: Field,
    privateFilesRoot: Field,
    uri1: Field,
    uri2: Field,
    pwdHash: Field,
  ) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const nameOld = this.name.get();
    this.name.assertEquals(nameOld);
    this.name.assertEquals(Field(0));

    const pwdHashOld = this.pwdHash.get();
    this.pwdHash.assertEquals(pwdHashOld);
    this.pwdHash.assertEquals(Field(0));

    const publicMapRootOld = this.publicMapRoot.get();
    this.publicMapRoot.assertEquals(publicMapRootOld);
    this.publicMapRoot.assertEquals(Field(0));

    const publicFilesRootOld = this.publicFilesRoot.get();
    this.publicFilesRoot.assertEquals(publicFilesRootOld);
    this.publicFilesRoot.assertEquals(Field(0));

    const privateMapRootOld = this.privateMapRoot.get();
    this.privateMapRoot.assertEquals(privateMapRootOld);
    this.privateMapRoot.assertEquals(Field(0));

    const privateFilesRootOld = this.privateFilesRoot.get();
    this.privateFilesRoot.assertEquals(privateFilesRootOld);
    this.privateFilesRoot.assertEquals(Field(0));

    const uri1Old = this.uri1.get();
    this.uri1.assertEquals(uri1Old);
    this.uri1.assertEquals(Field(0));

    const uri2Old = this.uri2.get();
    this.uri2.assertEquals(uri2Old);
    this.uri2.assertEquals(Field(0));

    this.name.set(name);
    this.publicMapRoot.set(publicMapRoot);
    this.publicFilesRoot.set(publicFilesRoot);
    this.privateMapRoot.set(privateMapRoot);
    this.privateFilesRoot.set(privateFilesRoot);
    this.uri1.set(uri1);
    this.uri2.set(uri2);
    this.pwdHash.set(pwdHash);
  }

  @method updatePublicMap(secret: Field, proof: MinaNFTMapProof) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const pwdHash = this.pwdHash.get();
    this.pwdHash.assertEquals(pwdHash);
    this.pwdHash.assertEquals(Poseidon.hash([secret]));

    const root = this.publicMapRoot.get()
    this.verifyMapProof(root, proof)

    this.publicMapRoot.set( proof.publicInput.latestRoot) 
  }

  
  @method updatePrivateMap(secret: Field, proof: MinaNFTMapProof) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const pwdHash = this.pwdHash.get();
    this.pwdHash.assertEquals(pwdHash);
    this.pwdHash.assertEquals(Poseidon.hash([secret]));

    const root = this.privateMapRoot.get()
    this.verifyMapProof(root, proof)

    this.privateMapRoot.set( proof.publicInput.latestRoot) 
  }

/*
  @method verifyMapWitness(state: Field, key: Field, value: Field, merkleMapWitness: MerkleMapWitness) {
    const [witnessRoot, witnessKey] = merkleMapWitness.computeRootAndKey(value)
    witnessRoot.assertEquals(state)
    witnessKey.assertEquals(key)
  }
*/

  @method verifyMapProof(state: Field, minaNFTStateProof: MinaNFTMapProof) {
    minaNFTStateProof.publicInput.initialRoot.assertEquals(state)
    minaNFTStateProof.verify()
  }

  /*
  @method verifyTreeWitness(state: Field, index: Field, value: Field, merkleTreeWitness: MerkleWitness10) {
    const witnessRoot = merkleTreeWitness.calculateRoot(value)
    const calculatedIndex = merkleTreeWitness.calculateIndex()
    witnessRoot.assertEquals(state)
    calculatedIndex.assertEquals(index)
  }
 */

  @method verifyTreeProof(state: Field, minaNFTTreeProof: MinaNFTTreeProof) {
    minaNFTTreeProof.publicInput.root.assertEquals(state);
    minaNFTTreeProof.verify();
  }
/*
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
    // TODO - rewrite using privateMapRoot
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
}
